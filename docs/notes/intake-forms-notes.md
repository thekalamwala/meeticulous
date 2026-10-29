# Intake Forms — Notes (parked, not specced/built)

_Q1 "Prove value" item #5. Status: NOTES ONLY — capture the idea; brainstorm → spec → build when prioritized._

## Concept
Hosts define **pre-session intake questions per service**; the guest answers them **at booking
time**; answers are attached to the booking so the host arrives prepared. Differentiates for
therapists, consultants, tutors, clinics, coaches.

## Rough shape (to refine in a real brainstorm later)
- **Per-service question set** — host builds questions in service setup (like the ServiceForm
  fields). Order matters.
- **Question types (start small):** short text, long text, single-choice, multi-choice.
  Maybe a required flag per question. (File upload / conditional logic / scoring = later.)
- **Guest answers at booking** — rendered in the booking flow (a step in `ServiceBooking`);
  submitted with the booking.
- **Storage:** answers snapshot on the booking (JSONB), immutable (question text + answer
  captured at booking time so later edits to the form don't change past bookings — mirror the
  immutable-snapshot rule from the partial-payments spec).
- **Host view:** answers shown on the host booking detail + optionally in the host booking
  confirmation email.

## Open questions (decide at brainstorm)
- Plan-gated? (a `intake_forms` limit like `followup_flows`, or free for all?)
- Which question types in v1 (keep it 3–4, no conditional logic).
- Required vs optional questions; validation.
- Guest privacy / sensitive answers (therapy/clinic context) — where stored, who sees.
- Show answers to the guest in `/user/my-bookings`?

## Explicitly NOT decided / NOT built
No spec, no plan, no code yet. This file is a placeholder so the idea isn't lost. When picked
up: run `superpowers:brainstorming` → spec → TDD plan → subagent build (same flow as #3/#7).

## Related
- Immutable snapshot pattern: `docs/superpowers/specs/2026-07-01-partial-payments-design.md`.
- Service setup UX lives in `client/src/pages/services/ServiceForm.jsx` + dual write
  (`serviceController` + `hostController`).
