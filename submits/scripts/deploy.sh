#!/usr/bin/env bash
# Build, publish, and deploy the 3-tier app to Docker Desktop Kubernetes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REGISTRY="localhost:5000"
BACKEND_IMAGE="${REGISTRY}/result-backend:latest"
FRONTEND_IMAGE="${REGISTRY}/result-frontend:latest"
INGRESS_MANIFEST="https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.13.3/deploy/static/provider/cloud/deploy.yaml"

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERROR: '$1' is required but not installed." >&2; exit 1; }
}

need docker
need kubectl

echo "==> Checking Docker and Kubernetes"
docker info >/dev/null
kubectl get nodes >/dev/null

echo "==> Checking credential files"
if [ ! -f "$ROOT/k8s/backend.env" ] || [ ! -f "$ROOT/k8s/postgres.env" ]; then
  echo "ERROR: k8s/backend.env and k8s/postgres.env are required." >&2
  echo "Copy the .example files and fill in the values first." >&2
  exit 1
fi

echo "==> Starting local registry on ${REGISTRY}"
if ! docker inspect registry >/dev/null 2>&1; then
  docker run -d -p 5000:5000 --restart=always --name registry registry:2
elif [ "$(docker inspect -f '{{.State.Running}}' registry)" != "true" ]; then
  docker start registry
fi

echo "==> Building images"
docker build -t "$BACKEND_IMAGE" "$ROOT/backend"
docker build -t "$FRONTEND_IMAGE" "$ROOT/frontend"

echo "==> Publishing images to ${REGISTRY}"
docker push "$BACKEND_IMAGE"
docker push "$FRONTEND_IMAGE"

echo "==> Installing ingress-nginx if needed"
if ! kubectl get deployment -n ingress-nginx ingress-nginx-controller >/dev/null 2>&1; then
  kubectl apply -f "$INGRESS_MANIFEST"
fi
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=300s

# The controller Pod can be Ready before its admission webhook is serving.
# Applying an Ingress too early fails with "connection refused".
echo "==> Waiting for the ingress admission webhook"
for attempt in $(seq 1 60); do
  WEBHOOK_IPS="$(kubectl get endpoints -n ingress-nginx ingress-nginx-controller-admission \
    -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null || true)"
  if [ -n "$WEBHOOK_IPS" ]; then
    break
  fi
  sleep 2
  if [ "$attempt" -eq 60 ]; then
    echo "ERROR: ingress admission webhook did not become ready." >&2
    exit 1
  fi
done

echo "==> Deploying Kubernetes resources"
# A Job's pod template is immutable; recreate it before applying changes.
kubectl delete job django-migrate -n app --ignore-not-found 2>/dev/null || true
for attempt in 1 2 3 4 5; do
  if kubectl apply -k "$ROOT/k8s"; then
    break
  fi
  echo "Apply attempt ${attempt} failed (admission webhook may still be warming up); retrying..."
  sleep 5
  if [ "$attempt" -eq 5 ]; then
    echo "ERROR: kubectl apply failed after 5 attempts." >&2
    exit 1
  fi
done

echo "==> Waiting for PostgreSQL"
kubectl rollout status statefulset/postgres -n db-production --timeout=300s

echo "==> Waiting for migrations / teacher account"
kubectl wait --for=condition=complete job/django-migrate -n app --timeout=300s

echo "==> Waiting for application tier"
kubectl rollout status deployment/backend -n app --timeout=300s
kubectl rollout status deployment/frontend -n app --timeout=300s

echo "==> Refreshing the submission manifest copy"
mkdir -p "$ROOT/submits/manifests"
cp "$ROOT"/k8s/kustomization.yaml \
   "$ROOT"/k8s/Database.yaml \
   "$ROOT"/k8s/Redis.yaml \
   "$ROOT"/k8s/Backend.yaml \
   "$ROOT"/k8s/Frontend.yaml \
   "$ROOT"/k8s/Ingress.yaml \
   "$ROOT"/k8s/backend.env.example \
   "$ROOT"/k8s/postgres.env.example \
   "$ROOT/submits/manifests/"

echo
echo "Deployment complete."
echo "App:    http://localhost/"
echo "Health: http://localhost/api/health/"
echo
kubectl get pods -n app
kubectl get pods -n db-production
