# EduQuiz — The study desk

## Direction
Adult self-directed learning; editorial, purposeful, tactile without imitation paper textures. Warm ivory canvas, charcoal text, burnt-orange primary actions, crisp ruled dividers, restrained rounded corners. A serif display voice with readable sans-serif controls. No gratuitous gradients, floating sparkles, motivational filler, or invented learner statistics.

## Skill provenance and decisions
Applied [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), specifically `.claude/skills/ui-ux-pro-max/SKILL.md`, the React stack guidance, modal focus guidance and accessibility/responsive checklists. Product-wide searches returned children's-education and AI-chat directions that did not fit; these outputs were not persisted as a validated product recommendation. The editorial typography search was relevant. This master is an intentional product-specific synthesis, with palette/layout choices made for EduQuiz.

## Tokens
- Ink `#242823`; muted text `#62675e`; canvas `#f6f4ed`; surface `#fffefa`.
- Orange `#b84120` on white for primary controls; pale orange `#f8e7dc` for accents.
- Green `#3e634b` and muted green backgrounds for verified success; error `#a82f27`.
- Serif: Georgia (system native). Sans: Manrope, system fallback. Mono: ui-monospace for small indices.
- Body: 16px; secondary: 14px; labels: 12px; display: 44–80px responsive.
- Controls: minimum 44px; corners: 8px buttons, 16px panels; spacing: 4/8px increments.

## Screens
Landing: asymmetric editorial hero plus a real interactive, explicitly labeled quiz preview. No fabricated testimonials.
Dashboard: one featured learning path, compact real metrics, useful next actions, recent evidence and skills.
Paths/practice: searchable, filtered collection; completed items open actual assessment results.
Mission: readable lesson, persistent local task/answer draft, step indicator, quiz mode and skill-specific result review. Server controls progression.
Reports: accessible score chart plus textual evidence, real dates, per-attempt review.
Settings: explicit connection state, provider costs, visible key deletion confirmation, account/session controls.
Admin: independent user/log pagination and usable narrow-screen tables.

## Behavior
Hash routes preserve navigation across refresh/back. A pending result is recoverable from report evidence. Async actions have scoped loading, duplicate-submission protection, retry feedback and expired-session recovery. Native modal dialogs trap focus, support Escape and return focus. Form errors stay in context. Reduced motion supported. No page-level horizontal overflow at 375, 768, 1024 or 1440px.
