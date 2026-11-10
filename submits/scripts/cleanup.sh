#!/usr/bin/env bash
# Remove the assignment workloads. This deletes the PersistentVolumeClaims
# (and therefore the PostgreSQL/Redis data) but leaves the local registry and
# ingress-nginx installed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "==> Deleting Kubernetes resources"
kubectl delete -k "$ROOT/k8s" --ignore-not-found

echo "==> Deleting namespaces app and db-production"
kubectl delete namespace app db-production --ignore-not-found

echo "Cleanup complete."
