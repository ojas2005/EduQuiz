# EduQuiz

An adaptive learning MVP: choose a topic, follow small missions, test understanding, and choose whether to work on weak skills before moving on.

- `doc/PRD.md` — product requirements, user/admin journeys and feature roadmap
- `doc/TSP.md` — technical specification, contracts, security and assessment policy
- `doc/ARCHITECTURE.md` — deployment, trust boundaries, state and sequence diagrams
- `frontend/` — React + TypeScript
- `backend/` — FastAPI + LangChain + LangGraph
- `infra/` — rate-limited Nginx gateway with two API replicas

## Start locally
Requires Docker Engine with Compose and Node 22+ if rebuilding the frontend lockfile.

```sh
python3 scripts/setup_env.py
docker compose up --build -d
```

Open http://localhost:8080 and create an account. The generated local configuration enables a clearly labeled “sentences” demo without a provider key. For other topics, open Settings, select OpenAI or Anthropic, enter an available model ID and your key. The key is encrypted at rest and never returned by the API. Unsupported models produce a recoverable error. Real provider calls incur charges on your provider account.

Generated `.env` has mode 0600 and is ignored by Git. Do not commit it or put keys in React/Vite environment variables. Default local HTTP uses `SECURE_COOKIES=false`; production must use HTTPS, `SECURE_COOKIES=true`, the exact external `ORIGIN`, and `DEMO_MODE=false`.

## Provision an admin
First register the intended account, then run the private operator command:

```sh
docker compose exec api1 python -m app.manage make-admin --email admin@example.com
```

Reload the application to see Administration. There are no default administrator credentials, public role selectors or public promotion endpoints.

## Development and verification
```sh
cd frontend
npm ci
npm run dev
npm run build
```

Vite proxies `/api` to `localhost:8000`. For this separate development setup run the backend there with PostgreSQL/Redis reachable via your own local connection settings and `ORIGIN=http://localhost:5173`. The default Compose does not expose API/data ports; using the full Compose origin is the simplest setup.

Backend requires Python 3.11+ (container uses 3.12):

```sh
cd backend
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.lock.txt
.venv/bin/python -m pytest tests/test_learning.py
```

Integration suite requires the Compose services running:

```sh
python3 scripts/integration_test.py
```

The integration test creates uniquely named test accounts and persistent test records. It expects local demo mode and does not use real API keys. Backend unit tests do not call providers.

```sh
docker compose ps
docker compose logs --tail=100 api1 api2
curl http://localhost:8080/api/health
docker compose down
```

`docker compose down` preserves named data volumes. Never add `--volumes` unless you intend to delete all local database/blob data.

## Scope
Implemented: signup/login/logout, rotating refresh, server-enforced user/admin roles, owned multi-mission paths, task checklists, skip gating, server scoring and feedback, remediation choice, standalone practice, reports/private blob export, encrypted keys, account suspension, audit logs, shared rate limiting and local load balancing.

The initial provider adapters cover OpenAI and Anthropic, not every provider/key format. Production follow-ups (migrations, recovery/email verification, MFA, durable jobs, provider quality evaluation, canonical skill taxonomy, telemetry, backups, accessibility review) are explicitly described in the documents. See `doc/VALIDATION.md` for what was actually tested.
