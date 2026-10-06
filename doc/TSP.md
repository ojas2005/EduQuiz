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
| GET | /me | Own account, display name, bio and avatar icon |
| PUT | /me | Bearer + trusted Origin; `{name,bio,avatar}` → updated own profile; 20 updates/minute |
| GET / PUT / DELETE | /credential | Metadata / `{provider,model,api_key}` / deletion |
| POST | /courses | `{topic,practice}` → validated curriculum without correct answers |
| GET | /courses | Up to 100 newest owned paths |
| GET | /courses/{id} | Owned path, current mission only has lesson/questions |
| POST | /courses/{id}/quiz/refresh | `{mission_index,quiz_revision}` → fresh scenario questions and updated quiz revision |
| POST | /courses/{id}/submit | `{mission_index,quiz_revision,answers,skip,tasks_completed}` → score, skills, per-option explanations, attempt_id, updated course |
| POST | /courses/{id}/decision | `{attempt_id,remediate}` → updated path |
| GET | /report | Own chronological attempts + aggregated skill scores |
| POST | /report/export | Archive private blob and return JSON attachment |
| GET | /admin/users?offset=0 | Admin only; 100 accounts per page |
| PATCH | /admin/users/{id} | Admin only; `{suspended}`; revokes sessions when suspending |
| GET | /admin/logs?offset=0 | Admin only; 100 metadata events per page |
| GET | /health | Checks PostgreSQL and Redis readiness |

Status codes: 400 invalid workflow/configuration; 401 invalid/revoked authentication; 403 role/origin denied; 404 resource not owned/not found; 409 stale decision/mission or conflicting account; 422 invalid schema; 429 limit exceeded with Retry-After; 502 provider failure; 503 limiter/blob unavailable. Unexpected errors use a generic response to avoid leaking credentials.

## Assessment and progression algorithm
1. Lock the owned course row. Reject a stale mission or quiz revision, a completed path, or a pending decision.
2. Require task self-attestation unless practice or skip mode.
3. Validate answer count exactly equals question count; each answer is an integer option index 0–3.
4. Compare against server-stored keys. Score = rounded correct/total × 100. Skill evidence is correct/total for questions tagged with each skill; strengths require at least 80%, others are weaknesses.
5. Insert an immutable attempt. A failed skip keeps the current mission. Normal submission, or a passing skip, may advance.
6. If advancement is permitted and weaknesses exist on a normal path, set pending_attempt. Otherwise increment current.
7. Accepting remediation generates exactly one focused mission; re-lock/recheck pending_attempt after generation and insert at current+1, then advance. Declining advances without insertion. Duplicate decisions cannot insert twice. LLM calls can still incur duplicate costs for concurrent requests; an idempotent job system is planned.
8. Completing a remediation uses the same rules; learners may remediate again or opt out. Practice never schedules remediation.

Returning from an unfinished quiz requests a replacement set for the active mission. The server validates that it covers every saved quiz topic, meets the minimum difficulty budget, and does not repeat the previous question prompts. It replaces the JSON snapshot under a row lock and increments `quiz_revision`; stale submissions fail with 409. The demo uses authored alternating scenario sets. A configured provider generates fresh scenarios for other topics, which consumes provider tokens. Retry feedback reveals answers, so repeated attempts remain practice rather than secure certification.

## AI orchestration
Graph: START → generate_validated_curriculum → END. State: topic, focus skill list, practice flag and validated curriculum. A system instruction separates learner topic data from behavioral instructions; no tools, browser, shell or database access are granted to the model. Pydantic constrains lesson sizes, question counts, topic coverage, option rationales and correct indexes. Normal paths require at least two missions; practice/remediation require exactly one. Provider adapters use one retry and a 60-second provider timeout; outer generation deadline is 90 seconds. Unsupported models, malformed output and refusals result in a safe 502 error, not persisted partial content.

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

## Adaptive learning update — 27 September 2026

A generated full path contains 2–8 chapters selected by topic scope, difficulty and importance. Each mission classifies its difficulty and importance before content generation. The server validates this question-count policy:

| Difficulty | Supporting | Core | Essential |
| --- | --- | --- | --- |
| Foundational | 3 | 4 | 5 |
| Intermediate | 4 | 5 | 6 |
| Advanced | 5 | 6 | 8 |

The table gives minimum question counts. Every assessable mission topic needs at least one question, even if the total exceeds the table value; the validated ceiling is 24. Practice and remediation generation still contain exactly one mission. Existing saved curricula are not regraded. Demo paths use authored scenario variants with varying chapter/question counts. Their focused remediation reuses matching skills and does not label a model-selected difficulty.

`POST /api/courses/{id}/submit` accepts `quiz_revision` and optional `question_order`, a permutation of every canonical question index. `answers` always stays in canonical order. Invalid permutations or stale revisions are rejected before grading; feedback is returned/stored in the displayed order. The frontend clears old selections and requests a new quiz on returning from the lesson. Feedback records the selected option, its specific rationale, the correct option and its rationale. Option ordering is unchanged.

Completed non-practice course responses include `suggested_topic: {topic, reason}`. New AI curricula persist a model-suggested next topic; older paths use a deterministic fallback. Merely viewing or dismissing the suggestion makes no generation request. `POST /api/courses/{id}/continue` requires ownership and completion, and creates the successor only after explicit acceptance. Repeated calls return the linked successor; a row lock prevents duplicate successor records across racing requests, although simultaneous provider calls can still incur duplicate generation cost. The link and recommendation live in existing mission JSON so no schema migration is needed.

The completion dialog supports accepting, dismissing and returning home. Dismissal is remembered per user/course for the current browser tab; the recommendation can be reopened. API generation failures keep the completed course and show a retryable dialog error. Local demo continuation supports Sentences → Paragraphs; other topics require a configured provider.


## Profile and workspace navigation — 28 September 2026

Profile details live in the new `user_profiles` table keyed by `users.id`; display name remains `users.name`. Existing accounts receive an empty bio and initial avatar until first save. The local init-db command creates the new table without altering existing user rows. Existing deployments must run the updated initializer before starting the updated APIs; production should deploy an equivalent schema migration.

Names are trimmed and limited to 1–100 characters, bios to 300, and avatar values to `initials`, `book`, `sparkles`, `sprout`, `rocket`, or `coffee`. Updates derive ownership from the authenticated session; role, email and user ID cannot be supplied. Saves are rate-limited and audited without storing profile text in the audit event. A user-row lock serializes first-time profile creation. Login, refresh and `/me` all return the saved profile.

Navigation starts closed at every viewport. The header menu button opens a modal drawer with native focus containment, Escape/close/backdrop dismissal, a scrollable middle and a fixed logout footer. Navigation slides over 260–320ms; learning views and dialogs enter over 260–280ms. The close button, profile Done and recommendation Not now actions animate before removal. Reduced-motion preferences disable animation and smooth scrolling.
