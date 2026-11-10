# Kubernetes manifests

This folder is an exact copy of the manifests deployed to the Docker Desktop
cluster. The repo's working copy is `k8s/`; these files are included so the
submission is self-contained.

## Use this copy directly

```bash
cp backend.env.example backend.env
cp postgres.env.example postgres.env
# Edit both files. Use the same POSTGRES_PASSWORD in each file.
kubectl apply -k .
```

The generated Secrets are `backend-secret` (namespace `app`) and
`postgres-secret` (namespace `db-production`).

The images are expected at:

- `localhost:5000/result-backend:latest`
- `localhost:5000/result-frontend:latest`

The real `backend.env` and `postgres.env` files are intentionally **not**
included in this submission.
