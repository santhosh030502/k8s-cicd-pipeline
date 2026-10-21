#!/usr/bin/env bash
# Creates a local kind cluster, builds the image and deploys with helm.
set -euo pipefail

CLUSTER=task-api
IMAGE=task-api:local

for bin in kind kubectl helm docker; do
  command -v "$bin" >/dev/null || { echo "$bin is not installed"; exit 1; }
done

if ! kind get clusters | grep -q "^${CLUSTER}$"; then
  echo "creating kind cluster '${CLUSTER}'"
  kind create cluster --name "$CLUSTER"
fi

echo "building image"
docker build -t "$IMAGE" app

echo "loading image into kind"
kind load docker-image "$IMAGE" --name "$CLUSTER"

echo "deploying with helm"
helm upgrade --install task-api helm/task-api \
  --namespace task-api --create-namespace \
  --set image.repository=task-api \
  --set image.tag=local \
  --set image.pullPolicy=Never \
  --wait

kubectl -n task-api get pods,svc
echo
echo "run this to reach the api:"
echo "  kubectl -n task-api port-forward svc/task-api 8080:80"
echo "  curl localhost:8080/healthz"
