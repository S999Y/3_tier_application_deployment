# Manual Deployment and Verification Steps

This guide performs the whole assignment **without the helper scripts**.
Run every command from the repository root
(`P:\DevOps\assignment_15\3-tire-app`) in Git Bash, WSL, or a similar shell.

The deployed result is already available at **http://localhost/**.
Use [Access and screenshots](#access-and-screenshots) to capture evidence.

## 0. Prerequisites

- Docker Desktop is running with **Kubernetes enabled**.
- `kubectl` points at the `docker-desktop` context.
- Port `5000` is free for the local registry, and port `80` is free for
  ingress-nginx.

```bash
kubectl config use-context docker-desktop
kubectl get nodes
kubectl get storageclass
```

Expected: one `docker-desktop` node `Ready` and a default `hostpath`
StorageClass.

## 1. Create the credential files

The real files are gitignored and are **not** part of the submission.

```bash
cp k8s/postgres.env.example k8s/postgres.env
cp k8s/backend.env.example k8s/backend.env
```

Edit both files in an editor:

- `k8s/postgres.env`: set `POSTGRES_PASSWORD` to a strong password.
- `k8s/backend.env`: set the **same** `POSTGRES_PASSWORD`, a long
  `DJANGO_SECRET_KEY`, and a teacher password in
  `DJANGO_SUPERUSER_PASSWORD`.
- Keep `DJANGO_SUPERUSER_USERNAME=teacher`.
- Leave `POSTGRES_DB=results` and `POSTGRES_USER=results` unless you also
  change the manifests.

Both env files are consumed by `k8s/kustomization.yaml`; no Secret values are
written into the YAML files.

## 2. Start the local image registry

```bash
docker run -d -p 5000:5000 --restart=always --name registry registry:2
curl http://localhost:5000/v2/_catalog
```

If the container already exists:

```bash
docker start registry
```

## 3. Build and push the images

```bash
docker build -t localhost:5000/result-backend:latest ./backend
docker build -t localhost:5000/result-frontend:latest ./frontend
docker push localhost:5000/result-backend:latest
docker push localhost:5000/result-frontend:latest
```

Verify:

```bash
curl http://localhost:5000/v2/_catalog
docker images | grep localhost:5000/result
```

`k8s/kustomization.yaml` rewrites the Deployment images to these
`localhost:5000/...` tags, so the cluster pulls from the registry.

## 4. Install ingress-nginx

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.13.3/deploy/static/provider/cloud/deploy.yaml
kubectl rollout status deployment/ingress-nginx-controller -n ingress-nginx --timeout=300s
kubectl get pods -n ingress-nginx
kubectl get svc -n ingress-nginx
```

Wait until the controller Pod is `Running` and the
`ingress-nginx-controller-admission` Service has an endpoint. If the next step
fails with a webhook "connection refused" error, wait a few seconds and re-run
`kubectl apply -k k8s`.

## 5. Deploy the application

A Kubernetes Job's Pod template is immutable, so remove the old migration Job
first (this is safe on the first run):

```bash
kubectl delete job django-migrate -n app --ignore-not-found 2>/dev/null || true
kubectl apply -k k8s
```

Wait for every workload:

```bash
kubectl wait --for=condition=complete job/django-migrate -n app --timeout=300s
kubectl rollout status statefulset/postgres -n db-production --timeout=300s
kubectl rollout status statefulset/redis -n app --timeout=300s
kubectl rollout status deployment/backend -n app --timeout=300s
kubectl rollout status deployment/frontend -n app --timeout=300s
```

Check the result:

```bash
kubectl get pods -n app -o wide
kubectl get pods -n db-production -o wide
kubectl get deploy,sts,job -n app
kubectl get pvc -n app
kubectl get pvc -n db-production
kubectl get ingress -n app
```

Expected: backend, frontend, Redis, and PostgreSQL `1/1`; the migration Job
`Complete`; both PVCs `Bound`; the Ingress on host `localhost`.

## 6. Access the application

Open **http://localhost/** in a browser.

- Health JSON: **http://localhost/api/health/**
- Student tab: **Check Result**.
- Teacher tab: **Teacher Portal**.

The teacher username is `teacher`. Read the teacher password from
`DJANGO_SUPERUSER_PASSWORD` in `k8s/backend.env` (open the file in an editor;
do not paste it into the submission).

If `http://localhost/` does not load, use a port-forward:

```bash
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80
```

Then open **http://localhost:8080/**. The request still uses
`Host: localhost`, so the Ingress rule matches.

### Access and screenshots

Take screenshots in this order:

1. **Flush the cache** so the first lookup must read PostgreSQL:
   ```bash
   kubectl exec -n app redis-0 -- redis-cli FLUSHALL
   ```
2. **Database screenshot** — at `http://localhost/`, enter `STU001` and click
   **Search**. The result shows Alice Rahman and a badge saying
   **served from database**.
3. **Cache screenshot** — click **Search** again. The same result now says
   **served from cache**.
4. **Health screenshot** — open `http://localhost/api/health/` and capture
   `{"status":"ok","database":"ok","redis":"ok"}`.
5. **Teacher login** — open **Teacher Portal**, log in with `teacher` and the
   password from `k8s/backend.env`.
6. **CSV upload** — choose `backend/sample_results.csv`, click **Upload**, and
   capture the summary (`Created`, `Updated`, `Students affected`).
7. **Terminal screenshots** — capture:
   ```bash
   kubectl get pods -n app
   kubectl get pods -n db-production
   kubectl get pvc -n app
   kubectl get pvc -n db-production
   kubectl get ingress -n app
   ```

If the rows already exist, a second upload reports `Updated: 9` instead of
`Created: 9`. To show a fresh insert, run:

```bash
kubectl exec -n db-production postgres-0 -- psql -U results -d results \
  -c "TRUNCATE results_result RESTART IDENTITY;"
kubectl exec -n app redis-0 -- redis-cli FLUSHALL
```

then upload `backend/sample_results.csv` again.

## 7. Manual functional verification

### Health

```bash
curl -sS http://localhost/api/health/
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://localhost/
```

### Teacher login and CSV upload

This reads the password into a shell variable without printing it:

```bash
TEACHER_PASS=$(sed -n 's/^DJANGO_SUPERUSER_PASSWORD=//p' k8s/backend.env)
TOKEN=$(curl -sS -X POST http://localhost/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"teacher\",\"password\":\"${TEACHER_PASS}\"}" \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
echo "token length: ${#TOKEN}"
```

Upload:

```bash
curl -sS -X POST http://localhost/api/results/upload/ \
  -H "Authorization: Token ${TOKEN}" \
  -F "file=@backend/sample_results.csv"
```

### Cache behaviour

```bash
kubectl exec -n app redis-0 -- redis-cli FLUSHALL
curl -sS http://localhost/api/results/STU001/   # source: database
curl -sS http://localhost/api/results/STU001/   # source: cache
kubectl exec -n app redis-0 -- redis-cli KEYS '*'
```

### PostgreSQL persistence

```bash
kubectl get pod postgres-0 -n db-production -o wide
kubectl get pvc -n db-production
kubectl delete pod postgres-0 -n db-production
kubectl rollout status statefulset/postgres -n db-production --timeout=300s
kubectl get pod postgres-0 -n db-production -o wide
kubectl get pvc -n db-production
kubectl exec -n app redis-0 -- redis-cli FLUSHALL
curl -sS http://localhost/api/results/STU001/   # source: database, same data
kubectl exec -n db-production postgres-0 -- \
  psql -U results -d results -c "SELECT COUNT(*) FROM results_result;"
```

The PVC name before and after must be the same, and the row count must still
be `9`.

### Re-run the automated checks

The submitted evidence is in [`README.md`](README.md). To reproduce the checks,
run the helper script; it prints progress to the terminal and writes a
temporary report outside `submits/`:

```bash
bash submits/scripts/verify.sh
```

## 8. Cleanup

Remove the application resources:

```bash
kubectl delete -k k8s
kubectl delete namespace app db-production
```

This also deletes the PVCs. Stop the local registry:

```bash
docker rm -f registry
```

To remove ingress-nginx as well:

```bash
kubectl delete -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.13.3/deploy/static/provider/cloud/deploy.yaml
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `kubectl apply -k k8s` fails with `failed calling webhook ... connection refused` | Wait for the ingress-nginx controller, then re-run the apply. |
| Pods show `ErrImagePull` / `ImagePullBackOff` | Ensure the `registry` container is running and both images were pushed; check `curl http://localhost:5000/v2/_catalog`. |
| `http://localhost/` does not load | Check `kubectl get ingress -n app`, `kubectl get svc -n ingress-nginx`, and `curl http://localhost/api/health/`. Use the port-forward fallback. |
| Backend is `CrashLoopBackOff` | `kubectl logs -n app deploy/backend`; confirm the Secret env keys and that PostgreSQL is ready. |
| Migration Job will not change after editing it | Delete it first: `kubectl delete job django-migrate -n app --ignore-not-found`, then re-apply. |
| PVC stays `Pending` | Confirm `kubectl get storageclass` shows `hostpath (default)`. |
| Teacher login fails | Check the username/password in `k8s/backend.env` and the migration Job logs (`kubectl logs -n app job/django-migrate`). |
| Every lookup says `database` | Check Redis: `kubectl get pod redis-0 -n app` and `kubectl exec -n app redis-0 -- redis-cli PING`. |
| Secret values must not be submitted | `k8s/backend.env` and `k8s/postgres.env` are gitignored; only the `.example` files belong in `submits/`. |
