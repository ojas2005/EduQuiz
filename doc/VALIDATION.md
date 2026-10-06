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


## Mission tutor — 3 October 2026
- TypeScript/Vite production build and 25 backend unit cases passed. Tutor cases cover mission context allowlisting (no quiz keys), follow-up roles, string/text-block responses, empty responses, output length and shared provider configuration.
- Full integration suite passed with chat ownership/authentication, locked/out-of-range missions, invalid roles, oversized inputs/history, demo responses, 10-request minute budget and unchanged progress/report assertions. Existing recap, grading, auth, reporting and admin regression checks passed.
- Browser checks on the synthetic Mira account: floating icon opens chat for the current Paragraphs mission, suggested question fills the composer, sending receives explicitly labelled saved-lesson demo guidance, closing/reopening retains the conversation, and a selected quiz answer survives opening/closing chat. No assessment was submitted during browser checks.
- Dark-mode desktop and 390 × 844 layouts visually inspected; the narrow dialog had no horizontal overflow. Temporary viewport reset and verification tab closed.
- Real model calls were mocked in unit tests; no paid provider call or live answer-quality evaluation was performed. Provider failure and timeout responses use a generic retry message; conversation bodies are not stored in the application database/audit log. The user's model provider may have its own retention policy.


## Short learning-path titles — 5 October 2026
- Production build and 40 backend unit tests passed; full integration suite passed after API startup completed.
- Added a nullable course title through the repeatable init-db upgrade. New paths save the generated title; existing paths use a bounded local fallback without changing their original topic.
- Browser verification used an isolated legacy-style card containing the long System Design syllabus. Both dashboard and library displayed “System Design Foundations”; searching “Idempotency” still found the card through its original topic.
- New path, practice and suggested-topic titles satisfy the 3–5 word contract, and remediation preserves the path title. No live-provider title-quality evaluation was performed.


## Account chat history and global launcher — 5 October 2026
- Production frontend build and full local integration suite passed. New coverage verifies saved/reopened conversations, appending turns without losing history, owner-only access, idempotent retries, stale revision rejection, rejection of client-supplied history for saved sessions, and repeatable imports of older browser conversations.
- Chats now persist in PostgreSQL, superseding the earlier browser-only storage. Audit events omit message bodies; conversation records retain messages for the authenticated owner. Provider context uses bounded recent history while the saved conversation keeps its earlier turns.
- Browser verification: chat launcher is a fixed direct child of body, visible at the top and bottom of a scrolling dashboard and on Settings. Reload showed a blank chat; Previous chats restored the earlier question/reply; sending a follow-up appended a second turn; New chat created a separate selectable saved conversation.
- The signed-out landing page has no chat launcher. Verification used an isolated synthetic account, then signed out and closed the test tab. Live-provider answer quality, cross-device UI behavior and adversarial concurrent load were not tested.

## Fresh, topic-complete quiz feedback — 7 October 2026
- Production frontend build, 47 backend unit tests and five frontend quiz tests passed. Tests cover the minimum question budget, expansion beyond that budget for topic coverage, distinct demo retry prompts, per-option feedback, and restoration of an interrupted draft to the lesson with a refresh required.
- Rebuilt local Compose services and passed the full black-box integration suite. It checked that refreshed public prompts differ, answer keys remain private, stale quiz revisions are rejected, feedback follows display order, and the existing skip, remediation, report, auth and admin flows still work.
- No paid model call was made. Scenario quality, coverage completeness beyond the saved quiz-topic list, and provider-specific structured-output behavior still require a live-model evaluation.
