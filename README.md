# HelpHero — Support Desk Platform

**Author:** Ram Tichkule  
**Course:** Session 21 — DevOps Final Capstone

---

## 1. Project Description

HelpHero is a full-stack customer support desk application that lets agents create, triage, and resolve support tickets. Each ticket carries a subject, description, category (Technical / Billing / General / Feature Request), priority (Low / Medium / High / Urgent), agent assignment, and a lifecycle status (Open → In Progress → Resolved).

The application is built to demonstrate a complete DevOps pipeline — from a developer laptop all the way to a monitored, auto-scaling Kubernetes cluster on AWS.

---

## 2. Architecture Overview

```text
Developer
   |
   v
Git / GitHub
   |
   v
GitHub Actions
   |-- pytest (11 test cases)
   |-- frontend build (Vite)
   |-- Docker build (backend + frontend)
   |-- Trivy security scan
   `-- push images to GHCR (SHA-tagged)
              |
              v
        Terraform
              |
       AWS VPC + EKS
              |
              v
         Helm Chart
              |
      +--------+--------+
      |                 |
  helphero-frontend  helphero-backend
    React/Nginx         FastAPI
         |                 |
         +----> helphero-postgres (PostgreSQL)
                       |
               Prometheus scrapes /metrics
                       |
                   Grafana dashboard
```

---

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Nginx |
| Backend | FastAPI (Python 3.12), SQLAlchemy, Alembic |
| Database | PostgreSQL 16 |
| Testing | Pytest, FastAPI TestClient |
| Containers | Docker (multi-stage for frontend) |
| CI/CD | GitHub Actions |
| Security | Trivy container scanning |
| Registry | GitHub Container Registry (GHCR) |
| Infrastructure | Terraform — AWS VPC + EKS |
| Orchestration | Kubernetes + Helm |
| Ingress | NGINX Ingress Controller |
| Autoscaling | Horizontal Pod Autoscaler (HPA) |
| Observability | Prometheus + Grafana |

---

## 4. REST API Endpoints

```
GET    /                    — service info
GET    /health              — liveness probe
GET    /ready               — readiness probe (checks DB)
GET    /metrics             — Prometheus metrics

GET    /api/tickets         — list all tickets
GET    /api/tickets/stats   — open / in-progress / resolved counts
GET    /api/tickets/{id}    — get single ticket
POST   /api/tickets         — create ticket
PUT    /api/tickets/{id}    — update ticket (status, agent, priority…)
DELETE /api/tickets/{id}    — delete ticket
```

Swagger UI: `http://localhost:8000/docs`

---

## 5. Local Setup

### Prerequisites

- Docker Desktop / Docker Engine
- Docker Compose

### Run with Docker Compose

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API docs | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |
| Metrics | http://localhost:8000/metrics |

### Stop

```bash
docker compose down        # stop containers
docker compose down -v     # also remove postgres volume
```

### Run backend directly (without Docker)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL='postgresql+psycopg://helphero:helphero@localhost:5432/helphero'
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

---

## 6. Testing

```bash
cd backend
pytest -v
```

The test suite covers:
- `GET /health` — liveness check
- `GET /` — root response
- `POST /api/tickets` — create (201) and validation (422)
- `GET /api/tickets` — list
- `GET /api/tickets/{id}` — fetch by ID and 404
- `PUT /api/tickets/{id}` — status and agent update
- `DELETE /api/tickets/{id}` — delete and verify 404
- `GET /api/tickets/stats` — stats shape

Tests use an in-memory SQLite database — production PostgreSQL is never touched.

---

## 7. CI/CD Pipeline

The pipeline triggers on every push to `main` and on pull requests.

```
test → docker-build → image-scan → push → deploy
```

| Job | What it does |
|-----|-------------|
| `test` | Runs `pytest -v` and builds the React frontend |
| `docker-build` | Builds both Docker images |
| `image-scan` | Trivy scans for HIGH/CRITICAL CVEs |
| `push` | Pushes SHA-tagged images to GHCR |
| `deploy` | Creates a Kind cluster, applies k8s manifests, smoke-tests |

Images are tagged with the Git commit SHA:

```
ghcr.io/<owner>/helphero-backend:<sha>
ghcr.io/<owner>/helphero-frontend:<sha>
```

---

## 8. Terraform — AWS Infrastructure

Terraform provisions:

```
AWS ap-south-1
├── VPC (10.0.0.0/16)
├── 2 public subnets
├── 2 private subnets
├── NAT Gateway
└── EKS cluster
      └── managed node group (t3.medium)
```

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

Configure kubectl after apply:

```bash
aws eks update-kubeconfig --region ap-south-1 --name <cluster-name>
```

Destroy when done:

```bash
terraform destroy
```

> Do **not** commit AWS credentials. Use environment variables or IAM roles.

---

## 9. Kubernetes + Helm Deployment

```bash
# Apply namespace
kubectl apply -f k8s/namespace.yaml

# Deploy via Helm
helm upgrade --install helphero ./helm/taskboard \
  --namespace helphero \
  --create-namespace

# Dev (with Ingress enabled)
helm upgrade --install helphero ./helm/taskboard \
  -n helphero \
  -f helm/taskboard/values-dev.yaml
```

Verify:

```bash
kubectl get pods -n helphero
kubectl get svc  -n helphero
helm list -n helphero
```

---

## 10. Observability — Prometheus + Grafana

The backend exposes Prometheus metrics at `/metrics` via the `prometheus-fastapi-instrumentator` library.

Install the monitoring stack:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  -f monitoring/prometheus-values.yaml
```

The `ServiceMonitor` in the Helm chart tells Prometheus to scrape `helphero-backend:80/metrics` every 15 seconds.

Access Grafana:

```bash
kubectl port-forward svc/kube-prometheus-stack-grafana 3001:80 -n monitoring
```

Open `http://localhost:3001` (default credentials: `admin` / `prom-operator`).

Useful metrics:
- `http_requests_total` — total request count by endpoint and status
- `http_request_duration_seconds` — latency histogram
- `http_requests_in_progress` — live in-flight requests

---

## 11. Known Issues / Limitations

- PostgreSQL is deployed inside the cluster for demo purposes. For production, use Amazon RDS.
- The HPA requires the Kubernetes Metrics Server to be installed in the cluster.
- Grafana dashboard panels need to be manually imported; JSON export is in `monitoring/`.

---

## 12. Repository Structure

```
devsecops-python/
├── frontend/               # React + Vite + Nginx
│   ├── src/main.jsx
│   └── src/styles.css
├── backend/                # FastAPI application
│   ├── app/                # models, schemas, routes, config, db
│   ├── alembic/            # DB migrations
│   └── tests/              # Pytest test suite
├── docker-compose.yml      # Full local stack
├── terraform/              # AWS VPC + EKS
├── helm/taskboard/         # Helm chart (helphero)
├── k8s/                    # Namespace + bootstrap manifests
├── monitoring/             # Prometheus/Grafana Helm values
├── scripts/                # Load test helper
├── troubleshooting/        # Intentionally broken manifests
└── .github/workflows/      # CI/CD pipeline
```
