import csv
import io
import logging
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.core.cache import cache
from django.db import connection, transaction
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Result

logger = logging.getLogger(__name__)

REQUIRED_COLUMNS = {"student_id", "student_name", "subject", "marks", "grade"}


def cache_key(student_id):
    return f"result:{student_id}"


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    """Liveness/readiness probe: checks both PostgreSQL and Redis."""
    checks = {}
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = f"error: {exc}"
    try:
        cache.set("health:ping", "pong", 5)
        checks["redis"] = "ok" if cache.get("health:ping") == "pong" else "error"
    except Exception as exc:
        checks["redis"] = f"error: {exc}"

    healthy = all(v == "ok" for v in checks.values())
    return Response(
        {"status": "ok" if healthy else "degraded", **checks},
        status=status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def get_result(request, student_id):
    """Public lookup. Served from Redis when cached, otherwise from PostgreSQL."""
    student_id = student_id.strip()
    key = cache_key(student_id)

    data = cache.get(key)
    if data is not None:
        logger.info("cache HIT for %s", student_id)
        return Response({**data, "source": "cache"})

    logger.info("cache MISS for %s", student_id)
    rows = list(Result.objects.filter(student_id=student_id))
    if not rows:
        return Response(
            {"detail": f"No result found for student ID '{student_id}'."},
            status=status.HTTP_404_NOT_FOUND,
        )

    total = sum(r.marks for r in rows)
    data = {
        "student_id": student_id,
        "student_name": rows[0].student_name,
        "subjects": [
            {"subject": r.subject, "marks": str(r.marks), "grade": r.grade} for r in rows
        ],
        "total_marks": str(total),
        "average": str(round(total / len(rows), 2)),
    }
    cache.set(key, data, settings.RESULT_CACHE_TTL)
    return Response({**data, "source": "database"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def upload_results(request):
    """Teacher-only CSV upload. Inserts new rows or updates existing ones."""
    upload = request.FILES.get("file")
    if upload is None:
        return Response({"detail": "No file uploaded (field name must be 'file')."}, status=400)
    if not upload.name.lower().endswith(".csv"):
        return Response({"detail": "Only .csv files are accepted."}, status=400)

    try:
        text = upload.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        return Response({"detail": "File must be UTF-8 encoded."}, status=400)

    reader = csv.DictReader(io.StringIO(text))
    headers = {h.strip().lower() for h in (reader.fieldnames or [])}
    missing = REQUIRED_COLUMNS - headers
    if missing:
        return Response(
            {"detail": f"Missing column(s): {', '.join(sorted(missing))}"}, status=400
        )

    created = updated = 0
    errors = []
    touched_ids = set()

    with transaction.atomic():
        # Line 1 is the header, so data starts on line 2.
        for line_no, raw in enumerate(reader, start=2):
            row = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items()}
            if not any(row.values()):
                continue  # skip blank lines
            if not row["student_id"] or not row["subject"]:
                errors.append({"line": line_no, "error": "student_id and subject are required"})
                continue
            try:
                marks = Decimal(row["marks"])
            except InvalidOperation:
                errors.append({"line": line_no, "error": "marks must be a number"})
                continue
            if not (0 <= marks <= 999):
                errors.append({"line": line_no, "error": "marks must be between 0 and 999"})
                continue

            _, was_created = Result.objects.update_or_create(
                student_id=row["student_id"],
                subject=row["subject"],
                defaults={
                    "student_name": row["student_name"],
                    "marks": marks,
                    "grade": row["grade"],
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1
            touched_ids.add(row["student_id"])

    # Invalidate cached results that just changed.
    cache.delete_many([cache_key(sid) for sid in touched_ids])

    return Response(
        {
            "created": created,
            "updated": updated,
            "students_affected": len(touched_ids),
            "errors": errors,
        },
        status=status.HTTP_201_CREATED if (created or updated) else status.HTTP_400_BAD_REQUEST,
    )
