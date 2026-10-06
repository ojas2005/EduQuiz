# EduQuiz — Product Requirements Document

Version 0.1 · 26 September 2026 · Status: MVP implementation with production roadmap

## Product vision
Turn an ambitious learning goal into manageable, interactive missions. Learners should understand what they know, identify what needs work, and control whether their next mission revisits a weakness or introduces a new topic. A mission is a pedagogical unit, not an LLM request. A single topic can have many missions; a generation request may produce multiple missions.

## Audience and roles
There are exactly two application roles: user and admin. Users manage only their own learning paths, results and provider credentials. Admins manage account status and inspect operational activity. Infrastructure operators can provision admins through a private command; this is an operational responsibility, not a third application role. Public signup always creates a user.

Initial audience: independent adult learners studying low-stakes academic and practical subjects. Child-specific consent, accredited grading, high-stakes advice, and classroom management require additional product and compliance work before launch.

## Core journeys
1. Visitor sees a landing page explaining missions, practice and progress, then registers or signs in.
2. Learner connects an OpenAI or Anthropic API key and chooses an available model. Keys are never displayed again. Provider usage can incur charges. Arbitrary provider URLs and automatic model discovery are outside this release.
3. “What do you want to learn?” accepts a topic of 2–300 characters. A normal path contains 3–6 progressively ordered missions. A provider may return up to 8 missions within the schema ceiling.
4. Each mission has an objective, substantive lesson, 2–5 hands-on tasks and at least 3 scenario-based multiple-choice quiz questions. The base count varies with difficulty and importance; more questions are required whenever the lesson has more assessable topics. Task checkboxes are learner self-attestation, not proof of mastery.
5. Learner completes tasks and takes a quiz. The server calculates percentage score, feedback, strengths and weaknesses by skill. 80% is the initial mastery threshold.
6. If any skill scores below 80%, offer “Cover my weaknesses” or “Continue to next topic.” Yes inserts one focused mission immediately after the assessed mission; no advances to the next original mission and preserves weak-skill evidence. This decision is also offered after the final normal mission.
7. A skip challenge bypasses lesson tasks, but requires at least 80% overall to advance. Failed skipping leaves the mission active; learners can study and retry. A passing skip with a weak skill still triggers the remediation choice.
8. Practice studio creates one independent quiz on a chosen topic, without enrolling in a normal path or changing existing path progression. Its results contribute to the growth report.
9. Dashboard lists active and completed paths, continuation entry points, completed mission count, aggregate score, and strength/weakness evidence. Growth report shows chronological attempts and per-skill aggregates; users can download a JSON report archived in private blob storage.
10. Admin lists user accounts and audit events, suspends or restores users. Suspension immediately prevents access and revokes sessions. Admin accounts cannot be suspended through the ordinary UI.

## Example: learning sentences
Original path: subjects and predicates → complete thoughts and fragments → simple/compound sentences → punctuation in context → mixed review. After mission one, a learner confuses subject identification but succeeds on predicates. The report shows the score and skill-specific evidence. Accepting help inserts “Finding the subject” before mission two; declining keeps the original sequence. Failing the skip challenge does not unlock mission two.

## Functional requirements and acceptance criteria
| ID | Requirement | Acceptance |
|---|---|---|
| F01 | Registration and authentication | Unique email; strong length validation; generic login errors; logout invalidates every device session |
| F02 | Provider management | Save, replace, inspect metadata and delete own key; stored key encrypted; never returned in API payloads |
| F03 | Multi-mission plans | A real provider request produces a validated ordered curriculum; failures preserve existing data and display a retryable error |
| F04 | Resume | Reload restores persisted mission position and any pending remediation decision |
| F05 | Assessment | Client cannot submit its own score or answer key; all questions require a valid answer |
| F06 | Skip gate | A failed skip leaves position unchanged; a passing skip advances or awaits remediation choice |
| F07 | Remediation | Yes inserts a weakness-focused mission once; no advances once; stale duplicate requests fail safely |
| F08 | Practice | One standalone quiz; no full chapter required; results appear in reports |
| F09 | Insights | Empty states never invent progress; report explains its aggregate evidence |
| F10 | Administration | Only admin role can access account/log endpoints; suspension revokes active sessions |
| F11 | Tenant isolation | Every learning resource is scoped to the authenticated user; another user receives 404 |
| F12 | Export | Only the owner can export a report; a private blob copy is stored and JSON downloaded |

## Feature brainstorm and prioritization
**Implemented MVP:** responsive landing/auth, dashboard, self-paced missions, task checklists, skip quiz, scored feedback, remediation branching, practice studio, growth chart, credential settings, report export, user suspension/restoration, paginated audit records, explicit local demo.

**Next release:** onboarding for existing level, learning objectives, preferred language and available daily time; mission notes/bookmarks; spaced repetition queue; confidence self-rating; mixed-topic practice; topic-qualified canonical skill taxonomy; accessible keyboard dialog focus management; password reset and email verification; user session list/revoke; admin user drilldown and content-issue review queue. Prioritize account recovery and validated quiz quality before engagement features.

**Later:** daily goal and optional reminders, streak grace days, achievement badges, transparent effort estimates, downloadable learning summaries, interactive ordering/matching exercises, trusted retrieval-backed lessons, attachments with antivirus scanning, spend/usage dashboard, hard per-user token budgets, admin support notes, time-bounded suspensions with reasons, moderation appeals, privacy export/deletion workflow, admin MFA and risk alerts. Do not portray badges as accredited certificates.

## UX and accessibility
Warm, calm workspace with restrained green, cream and lavender accents; clear progress and empty states. Responsive navigation, semantic forms and fieldsets, explicit quiz radio groups, visible focus indicators, text accompanying icons, and reduced-motion support. Target WCAG 2.2 AA; audit contrast, mobile screen readers, modal focus trapping and keyboard-only flows before release. Generated text is rendered as text, never raw HTML.

## Measurement
Primary metric: percentage of learners completing at least one mission and returning within seven days. Secondary metrics: path completion, remediation acceptance, post-remediation improvement, practice repeat use, abandonment, generation failure rate and cost per completed mission. Avoid treating repeated exposure to the same questions as independent proof of mastery. Current analytics are basic attempt aggregates; cohorts and provider-cost telemetry remain roadmap work.

## Non-functional targets
Production target, not benchmarked guarantee: 99.9% monthly availability; p95 non-generation requests under 500 ms at 100 concurrent users; generation completes or fails within 90 seconds; assessed answers are never leaked before submission; horizontal APIs share all authoritative state. Initial recovery targets: RPO 24 hours and RTO 4 hours, subject to backup and restore drills.

## Assumptions and decisions
BYOK is per learner. OpenAI and Anthropic are supported first; “any API key” cannot mean arbitrary compatibility because provider APIs and structured-output support differ. “TSP” is interpreted as Technical Specification Plan. Normal quiz completion permits advancing after the learner declines remediation even below 80%, honoring learner choice; skipping always requires 80%. Only multiple-choice quizzes are automatically graded in this release. A sample “sentences” curriculum is explicitly available only in local demo mode without credentials; no fake generation for other topics.

## Release gates
Complete security and integration tests; run real-provider curriculum quality evaluations; deploy HTTPS with managed secrets and private data services; verify backups; add password recovery/email verification and admin MFA; conduct accessibility and load tests; pin and scan release dependencies; implement versioned database migrations before evolving a populated production schema. These gates distinguish the runnable MVP from a publicly deployable service.

## Learning-flow additions — 27 September 2026
- Rereading a lesson and reopening its quiz replaces the questions and clears previous selections. Leaving or reloading an unfinished quiz returns to the mission first; opening the quiz then requests fresh scenarios. Grading remains independent of display order.
- Finishing a whole topic offers a related next topic in an opt-in dialog, along with a return-home action. Dismissing the dialog never generates or enrolls the learner in another topic.
- Chapter count and quiz length adapt to topic scope, difficulty and importance within bounded generation limits. The mission screen shows the difficulty, importance and actual question count when available.
