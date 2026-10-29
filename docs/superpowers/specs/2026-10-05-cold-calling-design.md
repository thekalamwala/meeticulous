# Cold Calling — admin tab (design)

Date: 2026-10-05 · Branch: `feat/cold-calling` (from `main`) · Ships: straight to `main` this week
(founder-approved exception to the October release train).

## Goal

Founder cold-calls local businesses from a phone while working a queue on a laptop
admin screen. Every call ends with an outcome; the right follow-up (email + WhatsApp)
goes out in one click; callbacks and retries come back on time. Email only goes to
people who were actually called (replaces the paused Topmate cold-email drip).

Success: every dialled lead has a logged outcome and a next step; follow-up sent
within minutes of the call; per-list outcome counts and signups visible.

First list: `bookasloth-top-priority-week.csv` — 353 Nagpur clinics/salons, columns
`Day,Priority,Business,Category,Locality,Phone,WhatsApp,Email,Fit,Website,Talking Point`.
The CSV is PII: never committed, uploaded only through the admin UI.

## Approach

Build on the existing Sales CRM (`leads`, `lead_lists`, `lead_activities`,
`lead_follow_ups`, `crm_templates`, `messageService`). **No migration.**
New: one admin page, one small server service + 4 routes, a template seed.

## Data model (existing tables only)

| Need | Stored in |
|---|---|
| Business, phone, email, website, city, category | `leads.business_name/phone/email/website/city/profession` |
| WhatsApp number | `leads.whatsapp_phone` — parsed from the WhatsApp URL (`wa.me/<n>` or `phone=<n>`, last 10 digits); fallback = phone |
| Calling-list membership + plan | `leads.attributes.cold_call = { list_id, day, priority, fit, locality, pitch, attempts, last_outcome, last_called_at, retry_at, closed }` |
| Callbacks + "Remind me" | `lead_follow_ups` rows, `remind=false` (no email), title prefixed `Callback:` |
| Calls | `lead_activities` `call_logged` via `leadService.logCall` (meta: outcome, duration_min, attempt) |
| Notes | `lead_activities` `note_added` via existing `addNote` |
| Sends | `crm_messages` via `messageService.enqueue` (human send → immediate, exempt from quiet hours + 48h cap) |
| List | `lead_lists` row (e.g. "Nagpur — top priority week"); new leads also get `list_id` + `status='list'` + tag `cold-call` |

Why not `leads.next_action_at` for callbacks: `lifecycleEngine` (15-min cron) overwrites
`next_action/next_action_at` for pipeline leads — a callback stored there would be lost.

Why list membership lives in `attributes.cold_call.list_id`: `upsertLead` never overwrites
an existing lead's `list_id`/`status`, so a re-imported existing lead must still join the
calling list without regressing its pipeline status.

## Import

Admin uploads the CSV in the tab; parsed in the browser (existing CSV util), columns
mapped to the fields above (auto-mapped by header name, editable), preview shows
valid/invalid/duplicates. Commit → `POST /api/admin/crm/cold-calls/import`
(batched client-side like `batchImport.js`):

1. Normalise phone (`0XXXXXXXXXX` → 10 digits; `upsertLead` normalises to its canonical form).
2. `upsertLead(patch, { source: 'cold_call', skipMetaLead: true })` — new leads cold in the list.
3. Deep-merge `attributes.cold_call` (set list_id/day/priority/fit/locality/pitch; keep
   existing attempts/last_outcome/closed). Re-import = idempotent, history preserved.

## Queue

`GET /api/admin/crm/cold-calls/queue?listId=` returns, in order:

1. **Callbacks due** — open `lead_follow_ups` titled `Callback:` with `due_at <= now + 15min`,
   for leads in the list (overdue flagged).
2. **Retries due** — `cold_call.retry_at <= now`, not closed.
3. **Fresh** — `attempts = 0`, not closed, ordered `day, priority`.

Excluded: `do_not_contact`, `cold_call.closed=true`. Also returns upcoming callbacks
(today, not yet due) for the countdown, and **today stats** (calls, connected,
interested, follow-ups sent — counted from today's `call_logged` / `crm_messages`
rows for leads in the list) plus list totals (per outcome, signed up = `profile_id` set).

Ordering/eligibility logic is a pure function (`buildQueue(leads, followUps, now)`)
so it is unit-testable without the DB.

## Outcomes

`POST /api/admin/crm/cold-calls/:leadId/outcome`
body `{ outcome, note?, durationSec?, callbackAt?, callbackNote?, send: { email?: bool, whatsapp?: bool }, email? }`

| Outcome | Follow-up template (pre-ticked) | Status move | Next |
|---|---|---|---|
| `interested` | `cold_call_interested` (signup link) | → `qualified` | closed (lives in pipeline) |
| `details` | `cold_call_details` (info pack) | → `contacted` | retry in 3 days |
| `callback` | `cold_call_callback` (reminder, mentions chosen time) | → `contacted` | follow-up task at `callbackAt` (required) |
| `not_now` | `cold_call_nurture` | → `contacted` | retry in 30 days |
| `not_interested` | none | → `do_not_contact` | closed |
| `no_answer` | none | unchanged | retry next day; 3rd no-answer → closed `unreachable` |
| `wrong_number` | none | unchanged + tag `wrong-number` | closed |

Status moves go through `leadService.changeStatus` with the admin as actor (guard
applies; `list → contacted/qualified` are forward moves; DNC passes a reason).
Moves never regress a lead already further along (skip if current rank ≥ target).

Order of work in the handler — **the call log is never lost to a send failure**:
1. Save edited email if provided (`updateLead`).
2. `logCall` (+ `addNote` if note).
3. Update `attributes.cold_call` (attempts, last_outcome, last_called_at, retry_at, closed).
4. Complete any open `Callback:` follow-up for the lead; create the new one if `callback`.
5. Status move.
6. Sends: for each ticked channel, `messageService.enqueue({ immediate: true,
   idempotencyKey: \`cold:${leadId}:${outcome}:${channel}:${YYYY-MM-DD}\`, senderKey: 'shubham' })`.
   Each send's result (sent / skipped + reason) is returned per channel, never thrown.

`POST /api/admin/crm/cold-calls/:leadId/remind` `{ at, note }` → `followUpService.create`
(`remind:false`, title `Callback: <note>`). Used by the "Remind me" button.

All routes: `requireAdmin('leads.view')` for GET, `leads.manage` for POST; mounted in
`adminCrmRoutes.js` (already under `adminLimiter`).

## Templates

8 `crm_templates` rows, category `cold_call_<outcome>` (interested, details, callback, nurture):

- **Email** — subject + body written in founder voice, variables `{{first_name}}`,
  `{{business_name}}`, `{{callback_time}}` (callback only). Sent from persona `shubham`
  (plain, hand-typed layout).
- **WhatsApp** — `name` = AiSensy campaign name (`cold_call_interested_wa`, …), params
  `[business_name]`. Founder creates + gets Meta approval in AiSensy; message texts are
  supplied in the PR. Rows seed `is_active=false`; the WhatsApp tickbox shows
  "pending AiSensy" with a **Mark approved** button (sets `is_active=true` via the
  existing template PATCH) — the Templates page lists only active rows, so approval
  happens in the Cold Calling tab.

Seeded by `server/scripts/seedColdCallTemplates.js` (upsert by name) — run on BOTH DBs.

## Screen — `/admin/sales/cold-calling` (laptop layout)

- Header: list picker, **Upload CSV**, today stats bar.
- Left: queue in three groups (Callbacks due · Retries · Fresh by Day), callback countdowns,
  overdue in red.
- Right: lead card — business, category, locality, Fit badge, Day/Priority; big phone number
  with one-click copy (+ `tel:` link); WhatsApp number; email with inline edit;
  **pitch + 5 objection answers** panel; history (last calls + notes from timeline);
  notes box; **call timer** (start/stop, fills duration); outcome buttons;
  follow-up panel (channels pre-ticked per outcome, preview, per-channel result chip);
  callback picker (In 1 hr · Today 5pm · Tomorrow 11am · Mon 11am · custom) + note;
  **Remind me** button; **Save & next**.
- Keyboard: `1`–`7` pick outcome, `Enter` = Save & next, `T` = start/stop timer
  (ignored while typing in an input).
- Reminders: page polls the queue every 60s; when a callback becomes due, browser
  `Notification` (permission asked once) + short sound. No email.
- Sidebar: "Cold Calling" entry under Sales. Existing design tokens/components only.

## Out of scope (phase 2)

Auto/power dialer, telephony integration (Exotel/Knowlarity click-to-call, recording),
multi-caller assignment, automated multi-step follow-up sequences, morning email digest.

## Testing

- Server unit: `buildQueue` ordering/eligibility (callback > retry > fresh; DNC/closed
  excluded; 3rd no-answer closes); outcome → next-step rules; WhatsApp URL parsing;
  outcome handler logs the call even when a send throws.
- Client: Vitest smoke render of the page.
- Gates: `cd server && npm test`, `cd client && npm test && npm run build`.
- Manual on staging (Tokyo) with 3 dummy rows: upload → call → Interested → timeline +
  queued messages; callback → appears at time.

## Rollout

PR → `main` (exception approved 2026-10-05). After merge: run template seed on both DBs,
founder creates 4 AiSensy campaigns, uploads CSV, starts calling. Topmate drip
`31108d17…` stays paused.
