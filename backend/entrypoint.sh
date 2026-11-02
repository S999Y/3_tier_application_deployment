#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying database migrations..."
  python manage.py migrate --noinput

  # Create the teacher account on first boot (no-op if it already exists).
  # Uses DJANGO_SUPERUSER_USERNAME / DJANGO_SUPERUSER_PASSWORD / DJANGO_SUPERUSER_EMAIL.
  if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
    python manage.py createsuperuser --noinput 2>/dev/null \
      && echo "Teacher account '$DJANGO_SUPERUSER_USERNAME' created." \
      || echo "Teacher account '$DJANGO_SUPERUSER_USERNAME' already exists."
  fi
fi

echo "Starting: $*"
exec "$@"
