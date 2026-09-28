# Validation record

Verified locally on 27 September 2026. This is evidence for the runnable MVP, not a production security certification.

## Passed
- React/TypeScript production build: `npm run build --prefix frontend`.
- Frontend dependency install audit reported zero known vulnerabilities at installation time.
- Five backend unit tests: demo schema validity, perfect grading, skill-specific strengths/weaknesses, the 80% threshold, and rejecting mismatched answer lengths.
- API import and Python compilation.
- Docker Compose build and startup with two healthy API replicas, healthy PostgreSQL and Redis, frontend, gateway, and Azurite blob emulator. Blob initialization completed successfully.
- Black-box integration script against the real local services: signup/login, denied admin access for users, answer-key redaction, cross-user 404, failed skip gate, remediation acceptance and insertion, remediation decline, successful skip, stale submission/decision rejection, standalone practice, growth report, private blob export, encrypted-credential metadata isolation and deletion, untrusted-origin rejection, generation rate limit, refresh rotation/replay revocation, admin suspension/restoration, audit visibility, and logout revocation.
- Final targeted API check: validation errors return 422 without echoing the supplied password.
- Browser smoke test: landing, login, persisted dashboard, mission lesson/tasks and roadmap, Settings, mobile-accessible logout. Checked the desktop dashboard layout at 1440px and restored the original viewport; document width matched viewport width.

## Not verified / release work
- Real OpenAI/Anthropic generation: no actual provider key supplied or used. Structured adapters import and validate locally; model compatibility, content quality, latency and refusal behavior require live-provider tests.
- No load benchmark, penetration test, formal WCAG audit, provider-content evaluation or disaster recovery drill was performed.
- Multi-tab refresh races, account recovery/email verification, admin MFA, production TLS/HSTS, authenticated data-service networking, managed secrets, migration versioning, durable jobs and retention remain documented production work.
- The local demo reuses a fixed question set. Results are learning feedback, not certification.

## Environment notes
The initial MinIO registry pulls failed. The delivered implementation uses Azure Blob through the official Python SDK and Azurite for local storage; there is no MinIO runtime dependency.

The integration scripts create synthetic records. Original known-password smoke accounts were deactivated after testing; subsequent test runs generate random passwords. No real user data or provider credentials were needed for verification.

The local stack is left running at `http://localhost:8080`. See the README for startup/shutdown commands and admin provisioning. Production use requires the release gates in the PRD and TSP.

## UI redesign verification — 27 September 2026

Applied the requested UI UX Pro Max skill; the product-specific decisions are recorded in `design-system/eduquiz/MASTER.md`. Rebuilt the landing page, dashboard, learning/practice library, mission and result views, growth report, settings and admin interface.

Browser checks against the running Docker stack passed for:
- Interactive landing-page quiz preview and login.
- Task-gated quizzes and draft answers surviving a page refresh.
- A 67% skip challenge preserving the current mission and returning to its lesson.
- A regular 67% assessment showing strengths, weaknesses and the remediation choice; the result and choice survived refresh. Accepting remediation inserted a mission focused on Joining clauses before the next topic.
- Standalone practice creation, 100% submission, navigation to its filtered growth report and opening historical answer review.
- Mobile navigation and dashboard document width matching viewports at 375, 768, 1024 and 1440 pixels. Temporary viewport override reset afterward.
- No warning/error console messages in the isolated verification tab.

The final TypeScript/Vite production build passed. The redesigned admin interface and real-provider generation were not exercised in this browser pass; the existing backend integration evidence above remains separate. Synthetic demo data was used throughout.

## Dark mode verification — 27 September 2026
- Added a keyboard-accessible header switch to the public and signed-in UI, with OS-theme default, saved explicit preference, cross-tab updates, and early theme application.
- Browser checks passed for mouse toggling, Space-key toggling, dark preference surviving refresh, dark dialogs, and a 44×44px toggle in the 375px signed-in header.
- Dark landing page document width matched 375, 768, 1024 and 1440px viewports. Temporary viewport overrides were reset. Dashboard and public-page dark palettes were visually inspected, including the interactive quiz preview. No browser warnings or errors were recorded in the verification tab.
- Production TypeScript/Vite build passed. Cross-tab and live OS-theme change listeners were implemented but not exercised by browser automation. This is not a formal accessibility audit.

## Adaptive learning flow — 27 September 2026
- Passed 17 backend unit cases covering grading, question budgets, variable demo chapter counts and next-topic selection.
- Passed four frontend tests covering permutations, guaranteed changed retry order, saved-order validation and canonical answer mapping.
- Passed the updated full integration suite, including rejection of malformed permutations, shuffled feedback alignment, different quiz sizes, no implicit successor creation, explicit/idempotent successor creation, incomplete/cross-user continuation rejection and existing auth/report/admin regressions.
- Browser verification with the synthetic Mira account: reread/reshuffle changes order; reload preserves it; correct shuffled answers score 100%; final-topic popup suggests Paragraphs; Not now and Return to home work; reopening and accepting starts the two-chapter Paragraphs path.
- Production TypeScript/Vite build passed. No real provider call was made for this update; model-selected difficulty, importance, chapter counts and recommendation quality still need live-provider evaluation.

## Sidebar, profiles and transitions — 28 September 2026
- Production TypeScript/Vite build passed, alongside 17 backend unit tests and four frontend quiz tests.
- Expanded integration suite passed: authenticated profile save, trimming, persistence through refresh, account isolation, blank/oversized input rejection, avatar allowlist, forbidden privilege/owner fields and unauthenticated update rejection. Existing learning, auth, report, admin and logout checks passed. Requests are paced below the gateway's general limit so added coverage does not accidentally trigger its burst protection.
- Browser verification: sidebar starts closed on desktop; menu opens a sliding drawer; close button and Escape dismiss it and restore focus to the menu. At 390 × 568, drawer and footer bottom coordinates both equal 568 while the middle scrolls.
- Header avatar opens profile editing; changed display name, sprout icon and bio saved successfully and remained after reload. Sample account values were restored afterward. Done dismisses the editor successfully.
- New learning-path dialog uses the 260ms entrance animation. Desktop dark-mode profile and drawer styling inspected; no browser warnings or errors recorded. Reduced-motion CSS is implemented but was not exercised with an OS preference change. This is not a formal accessibility audit.
