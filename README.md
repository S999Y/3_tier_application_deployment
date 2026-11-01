# Result Publishing App — 3-tier DevOps practice project

A deliberately small app for practising Docker, Compose, CI/CD, Kubernetes, monitoring, etc.

```
 Browser ──► frontend (React + nginx :3000) ──/api──► backend (Django + gunicorn :8000) ──► PostgreSQL :5432
                                                                     └─────────────────► Redis :6379 (cache)
```

| Tier         | Folder      | Tech                          |
|--------------|-------------|-------------------------------|
| Presentation | `frontend/` | React (Vite), served by nginx |
| Application  | `backend/`  | Django + Django REST Framework, gunicorn |
| Data         | (images)    | PostgreSQL 16, Redis 7        |

## Features

- **Students / public** — enter a Student ID, see the result. No login.
- **Teacher** — log in, upload a CSV of results. Rows with the same `student_id + subject` are updated.
- **Redis cache** — each lookup is cached for `RESULT_CACHE_TTL` seconds (default 300). Uploading
  a CSV clears the cache for affected students. The UI shows whether a result was
  *served from cache* or *served from database*, so you can watch the cache working.

CSV format (see [backend/sample_results.csv](backend/sample_results.csv)):

```csv
student_id,student_name,subject,marks,grade
STU001,Alice Rahman,Mathematics,92,A+
```

## Run it

### Option A — whole stack at once (from the project root)

```bash
docker compose up -d --build
```

### Option B — tier by tier

```bash
cd backend  && docker compose up -d --build   # Django + PostgreSQL + Redis, creates network "result-network"
cd ../frontend && docker compose up -d --build # React/nginx, joins "result-network"
```

Don't run A and B at the same time — they use the same host ports.

Then open:

- App: http://localhost:3000
- Health check: http://localhost:8000/api/health/ (checks DB + Redis)
- Django admin: http://localhost:3000/admin/

Default teacher login: **teacher / teacher123** (set via `DJANGO_SUPERUSER_*` env vars; see
[backend/.env.example](backend/.env.example)).

## API

| Method | Path                          | Auth              | Purpose                    |
|--------|-------------------------------|-------------------|----------------------------|
| GET    | `/api/health/`                | none              | DB + Redis health          |
| POST   | `/api/auth/login/`            | none              | `{username,password}` → `{token}` |
| POST   | `/api/results/upload/`        | `Token <token>`   | multipart field `file` (CSV) |
| GET    | `/api/results/<student_id>/`  | none              | Result lookup (cached)     |

Try it with curl:

```bash
TOKEN=$(curl -s -X POST localhost:8000/api/auth/login/ -H "Content-Type: application/json" \
  -d '{"username":"teacher","password":"teacher123"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')
curl -H "Authorization: Token $TOKEN" -F file=@backend/sample_results.csv localhost:8000/api/results/upload/
curl localhost:8000/api/results/STU001/   # "source": "database"
curl localhost:8000/api/results/STU001/   # "source": "cache"
```

## Local development without Docker

```bash
# Start only PostgreSQL + Redis
cd backend && docker compose up -d db redis

# Backend
python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

# Frontend (another terminal) — proxies /api to localhost:8000
cd frontend && npm install && npm run dev       # http://localhost:3000
```

## Handy DevOps exercises

- `docker compose logs -f backend` — watch `cache HIT` / `cache MISS` lines.
- `docker compose exec redis redis-cli KEYS '*'` — inspect cached keys.
- `docker compose exec db psql -U results -d results -c 'select * from results_result;'`
- Scale the app tier: `docker compose up -d --scale backend=3` (remove the `ports:` mapping on backend first).
- Stop Redis and hit `/api/health/` to see a 503.
