# k8s-cicd-pipeline

A small Node.js API that I use to practice the full path from code to Kubernetes:
Docker image, K8s manifests, a Helm chart, and a GitHub Actions pipeline that
tests, scans, builds and deploys it.

The app itself is simple on purpose (a basic task list API). The focus here is
on the DevOps side.

## What's inside

```
.
├── app/                  # Node.js + Express API
│   ├── src/
│   ├── test/
│   └── Dockerfile        # multi-stage, runs as non-root
├── k8s/                  # plain manifests (kustomize)
├── helm/task-api/        # helm chart with dev and prod values
├── scripts/              # spin up / tear down a local kind cluster
└── .github/workflows/    # CI pipeline
```

## Pipeline

```
push / PR
   │
   ├── test        → npm ci + unit tests
   ├── lint-k8s    → helm lint + kubeconform on manifests and rendered chart
   │
   ├── build       → docker build → trivy scan (fails on HIGH/CRITICAL)
   │                 → push to GHCR (main branch only)
   │
   └── deploy-test → creates a kind cluster inside the runner,
                     installs the chart and runs a smoke test with curl
```

The `deploy-test` job was the most useful part for me. It catches problems like
wrong probe paths or bad selectors that linting alone does not catch.

## API endpoints

| Method | Path          | Description                  |
|--------|---------------|------------------------------|
| GET    | `/`           | service info and version     |
| GET    | `/healthz`    | liveness probe               |
| GET    | `/readyz`     | readiness probe              |
| GET    | `/metrics`    | Prometheus metrics           |
| GET    | `/tasks`      | list tasks                   |
| POST   | `/tasks`      | create a task `{"title": ""}`|
| PATCH  | `/tasks/:id`  | update title / done          |
| DELETE | `/tasks/:id`  | delete a task                |

## Run it locally

**Without Docker**

```bash
make install
make run
curl localhost:3000/healthz
```

**With Docker**

```bash
make docker-run
```

**On a local Kubernetes cluster (kind)**

You need `docker`, `kind`, `kubectl` and `helm` installed.

```bash
make up
kubectl -n task-api port-forward svc/task-api 8080:80
curl localhost:8080/tasks
```

Tear it down with `make down`.

**Using plain manifests instead of helm**

```bash
kubectl apply -k k8s/
```

## Things I set up on purpose

- **Multi-stage Dockerfile** with only production deps, so the final image is small
- **Non-root container**, read-only root filesystem, and all Linux capabilities dropped
- **Liveness and readiness probes** on separate endpoints
- **Graceful shutdown**: the app handles SIGTERM so rolling updates don't drop requests
- **Rolling update with `maxUnavailable: 0`**, so there is no downtime during deploys
- **HPA** that scales on CPU (2 to 5 pods in dev, 3 to 10 in prod)
- **Resource requests and limits** on every container
- **Prometheus metrics** (request count and latency histogram). My
  [monitoring-stack](https://github.com/santhosh030502/monitoring-stack) repo can scrape these.
- **Image tags use the short git SHA**, so every deploy can be traced to a commit

## Prod values

```bash
helm upgrade --install task-api helm/task-api \
  -f helm/task-api/values-prod.yaml \
  --set image.tag=<git-sha> \
  -n task-api --create-namespace
```

## What I want to add next

- ArgoCD for GitOps style deploys
- Terraform to create an EKS cluster for a real cloud deploy
- Postgres instead of in-memory storage
