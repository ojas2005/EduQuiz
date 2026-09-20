# EduQuiz — Technical Specification Plan

Version 0.1 · 26 September 2026

## Scope and stack
React 19 + TypeScript + Vite SPA in `frontend/`. FastAPI + SQLAlchemy + Pydantic in `backend/`. LangChain provides OpenAI/Anthropic adapters and structured-output validation; LangGraph runs the curriculum-generation graph. PostgreSQL stores durable state; Redis provides distributed rate limiting; an private Azure Blob container (Azurite locally) stores report snapshots. Nginx serves a same-origin gateway, balances two API replicas with least connections, and enforces edge request limits.

## Domain and persistence
All primary entity IDs are UUID strings. PostgreSQL foreign keys relate owner IDs. ORM queries parameterize values. JSON is used for immutable curriculum snapshots and assessment evidence in this MVP.

| Table | Core data | Constraints / indexes |
|---|---|---|
| users | id, email, name, password_hash, role, suspended, created_at | unique normalized email |
| sessions | id, user_id, refresh_hash, used_hashes, expires_at, revoked | indexed owner; unique current hash |
| credentials | user_id, provider, model, ciphertext | one configuration per user |
| courses | id, user_id, topic, practice, missions JSON, current, pending_attempt, created_at | indexed owner |
| attempts | id, user_id, course_id, mission_index, result JSON, created_at | indexed owner; immutable results |
| audit_logs | id, actor_id, action, target_id, created_at | indexed actor; metadata only |

Initial schema creation is an explicit one-shot Compose init service using `create_all`. This is not a migration system: introduce Alembic revisions before changing a live schema. Production should add database role restrictions, retention jobs and indexes based on measured query patterns. Report currently reads all of one learner’s attempts; bound or pre-aggregate this before very large histories.

## API contract
All routes are under `/api`. JSON request validation rejects unknown fields. Access-authenticated routes require `Authorization: Bearer <access_token>`. Cookie-auth endpoints require the configured exact `Origin` header. Same-origin deployment removes the need for broad CORS permissions. Interactive OpenAPI lives at `/api/docs`.

| Method | Route | Contract |
|---|---|---|
| POST | /auth/signup | `{name,email,password}` → access token + public user; refresh cookie |
| POST | /auth/login | `{email,password}` → same; generic invalid-account response |
| POST | /auth/refresh | Rotating cookie → new access token and cookie; old reuse revokes session |
| POST | /auth/logout | Bearer + trusted Origin; revokes all user sessions and clears cookie |
| GET | /me | Public own profile |
| GET / PUT / DELETE | /credential | Metadata / `{provider,model,api_key}` / deletion |
| POST | /courses | `{topic,practice}` → validated curriculum without correct answers |
| GET | /courses | Up to 100 newest owned paths |
| GET | /courses/{id} | Owned path, current mission only has lesson/questions |
| POST | /courses/{id}/submit | `{mission_index,answers,skip,tasks_completed}` → score, skills, explanations, attempt_id, updated course |
| POST | /courses/{id}/decision | `{attempt_id,remediate}` → updated path |
| GET | /report | Own chronological attempts + aggregated skill scores |
| POST | /report/export | Archive private blob and return JSON attachment |
| GET | /admin/users?offset=0 | Admin only; 100 accounts per page |
| PATCH | /admin/users/{id} | Admin only; `{suspended}`; revokes sessions when suspending |
| GET | /admin/logs?offset=0 | Admin only; 100 metadata events per page |
| GET | /health | Checks PostgreSQL and Redis readiness |

Status codes: 400 invalid workflow/configuration; 401 invalid/revoked authentication; 403 role/origin denied; 404 resource not owned/not found; 409 stale decision/mission or conflicting account; 422 invalid schema; 429 limit exceeded with Retry-After; 502 provider failure; 503 limiter/blob unavailable. Unexpected errors use a generic response to avoid leaking credentials.

## Assessment and progression algorithm
1. Lock the owned course row. Reject a stale mission index, a completed path, or a pending decision.
2. Require task self-attestation unless practice or skip mode.
3. Validate answer count exactly equals question count; each answer is an integer option index 0–3.
4. Compare against server-stored keys. Score = rounded correct/total × 100. Skill evidence is correct/total for questions tagged with each skill; strengths require at least 80%, others are weaknesses.
5. Insert an immutable attempt. A failed skip keeps the current mission. Normal submission, or a passing skip, may advance.
6. If advancement is permitted and weaknesses exist on a normal path, set pending_attempt. Otherwise increment current.
7. Accepting remediation generates exactly one focused mission; re-lock/recheck pending_attempt after generation and insert at current+1, then advance. Declining advances without insertion. Duplicate decisions cannot insert twice. LLM calls can still incur duplicate costs for concurrent requests; an idempotent job system is planned.
8. Completing a remediation uses the same rules; learners may remediate again or opt out. Practice never schedules remediation.

Current quizzes are fixed in the stored curriculum. Retry feedback can reveal answers, so repeated attempts are practice, not secure certification. Next release should generate/rotate independent question pools with attempt limits for any higher-stakes assessment.

## AI orchestration
Graph: START → generate_validated_curriculum → END. State: topic, focus skill list, practice flag and validated curriculum. A system instruction separates learner topic data from behavioral instructions; no tools, browser, shell or database access are granted to the model. Pydantic constrains lesson sizes, question counts, options and correct indexes. Normal paths require at least three missions; practice/remediation require exactly one. Provider adapters use one retry and a 60-second provider timeout; outer generation deadline is 90 seconds. Unsupported models, malformed output and refusals result in a safe 502 error, not persisted partial content.

The adaptive progression policy is deterministic application code, not an LLM decision. PostgreSQL is the checkpoint between learner interactions; the LangGraph graph is not held open across the entire course. Long-running durable generation jobs, moderation, semantic curriculum checks, retrieval and quality evaluation are production follow-ups.

## Security specification
- Passwords: Argon2 via pwdlib; 12–128 characters; dummy-hash verification for nonexistent accounts.
- Session token: signed HS256 JWT, explicit issuer/audience, required subject/session/expiry/issued-at, 15-minute expiry. Stored only in browser memory. User status and DB session revocation are checked on every authenticated request.
- Refresh token: 48-byte URL-safe opaque secret; only SHA-256 hash stored; seven-day absolute session lifetime; rotated on use with row locking. Used hash replay revokes that session. Refresh cookie HttpOnly, SameSite=Strict, Secure in production and path `/api/auth`. Local generated config disables Secure only for HTTP loopback development.
- Refresh concurrency: frontend deduplicates refresh within a tab. Concurrent tabs can trigger reuse detection and require signing in again; coordinate tabs via BroadcastChannel or a bounded replay grace protocol before production.
- CSRF: exact Origin validation for signup/login/refresh/logout; other writes require a non-cookie bearer token. No wildcard CORS.
- Secrets: Fernet authenticated encryption for stored provider keys; encryption and JWT keys generated separately. Never log request bodies/credentials. Production uses KMS/secret manager and rotation playbooks.
- Authorization: derive user/role from database, not client claims; owner-scoped course queries and server-side admin guards; no role field accepted during signup.
- Abuse: Nginx per-IP general and auth limits; Redis atomic fixed-window limits for auth, account login, generation (5/hour/user), quiz (30/min/user), credential updates and exports. Redis failure fails closed. API does not trust incoming forwarded headers; the local Redis IP bucket sees gateway IP, so it is a conservative shared cap. Configure trusted ingress identity before public scaling.
- Input/output: small body limit, bounded schemas, React escaping, no HTML execution, restricted provider selection and no arbitrary endpoint URL to prevent SSRF. Generated educational content still requires quality/safety review.
- Network: only loopback gateway port published locally; databases and blob services on the internal Compose network. Production requires private networks, TLS, Redis ACL/auth and least-privilege storage credentials. Local Azurite uses an account key; use least-privilege managed identity or scoped credentials in production.
- Headers: CSP, no-sniff, frame denial, no-referrer, API no-store. Add HSTS at the production TLS terminator.
- Audit: signup, login success, credential changes, generation success, quiz submissions, decisions, session replay, admin changes and export events. No password/key values. Failed-login telemetry and tamper-resistant audit shipping remain release work.

## Implementation plan and validation
Phase 1 (implemented): repository, docs, core schemas, provider graph, auth/session security, deterministic learning policy, React screens, admin tools and Compose infrastructure.
Phase 2: integration verification against PostgreSQL/Redis/Azurite, provider smoke tests using an operator-supplied test key, curriculum evaluation set, accessibility review and deployment rehearsal.
Phase 3: durable asynchronous jobs and idempotency keys; Alembic migrations; recovery/verification/MFA; telemetry, backups, retention, spend controls and launch hardening.

Tests must cover grading, skip failure/success, remediation decline/accept, ownership boundaries, admin role rejection, answer-key redaction, refresh replay, suspension and stale double submission. Validate build via `npm run build`, unit tests via `pytest`, and services via Compose health checks. See `README.md` for exact commands and `doc/VALIDATION.md` for observed results.

## Official references checked
- [OpenAI structured output](https://developers.openai.com/api/docs/guides/structured-outputs): schema-constrained model results; application validation remains necessary.
- [FastAPI JWT/password security](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/): password hashing and bearer authentication building blocks.
- [LangGraph graph API source documentation](https://github.com/langchain-ai/docs/blob/main/src/oss/langgraph/graph-api.mdx): StateGraph orchestration.
