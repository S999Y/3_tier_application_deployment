from django.db import models


class Result(models.Model):
    """One row per student per subject — mirrors one line of the uploaded CSV."""

    student_id = models.CharField(max_length=50, db_index=True)
    student_name = models.CharField(max_length=100)
    subject = models.CharField(max_length=100)
    marks = models.DecimalField(max_digits=5, decimal_places=2)
    grade = models.CharField(max_length=5)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["student_id", "subject"]
        constraints = [
            models.UniqueConstraint(
                fields=["student_id", "subject"], name="unique_student_subject"
            )
        ]

    def __str__(self):
        return f"{self.student_id} - {self.subject}: {self.marks}"
