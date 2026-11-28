# Database Schema — Meeticulous

## Run Order for Fresh Setup
1. `server/config/schema.sql` — base tables + RLS
2. `server/migrations/v1.6_catchup.sql` — all columns through v1.6
3. `server/migrations/v1.7_pricing_snapshot.sql` — commission_applied ✅ applied (all migrations through v3.59 live on both DBs, verified 2026-07-01)

---

## Tables

### profiles
Extends `auth.users`. One row per user (host or guest).
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | References `auth.users(id)` |
| name | TEXT | Display name |
| email | TEXT | |
| role | TEXT | `'host'` or `'guest'` |
| username | TEXT UNIQUE | URL slug for public profile |
| bio | TEXT | |
| tagline | TEXT | Short headline |
| profession | TEXT | |
| profile_image | TEXT | Supabase Storage public URL |
| cover_image | TEXT | Supabase Storage public URL |
| social_links | JSONB | `{ instagram, youtube, linkedin, ... }` |
| theme_color | TEXT | Hex color (plan-gated palette) |
| is_verified | BOOLEAN | Admin-set verification badge |
| plan | TEXT | `'explorer'` \| `'creator'` \| `'professional'` |
| plan_expires_at | TIMESTAMPTZ | Null = no expiry (lifetime) |
| plan_updated_at | TIMESTAMPTZ | |
| google_calendar_connected | BOOLEAN | |
| google_access_token | TEXT | |
| google_refresh_token | TEXT | |
| razorpay_account_id | TEXT | For payouts |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Trigger:** `on_auth_user_created` → auto-creates profile row on Supabase auth signup.

**RLS:**
- SELECT: public (anyone can read)
- UPDATE: `auth.uid() = id`

---

### services
One service per row. Services belong to a host.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| host_id | UUID FK | → `profiles(id)` |
| title | TEXT | |
| description | TEXT | Legacy long description |
| short_description | TEXT | v2 — shown in cards |
| long_description | TEXT | v2 — full details |
| type | TEXT | `'one_on_one'` \| `'group'` \| `'paid_dm'` |
| duration | INTEGER | Minutes |
| price | NUMERIC(10,2) | 0 = free |
| currency | TEXT | Default `'INR'` |
| meeting_mode | TEXT | `'online'` \| `'offline'` |
| thumbnail_url | TEXT | Supabase Storage public URL |
| grace_period_minutes | INTEGER | Default 10 — overlap buffer |
| slug | TEXT | URL slug — **globally unique** (see Indexes below) |
| category | TEXT | Service category slug (v3.22); paired with `primary_category` since v3.60 |
| primary_category | TEXT | Host's profession at time of categorisation (v3.60, PENDING both DBs); NULL unless `category` is also set |
| is_active | BOOLEAN | Default true |
| included_items | JSONB | v2 — what's included |
| excluded_items | JSONB | v2 — what's not included |
| faqs | JSONB | v2 — FAQ array |
| important_note | TEXT | v2 — disclaimer |
| rating | NUMERIC | Cached average rating |
| total_reviews | INTEGER | Cached review count |
| total_bookings | INTEGER | Cached count |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:**
- `UNIQUE (host_id, slug)` — `services_host_slug_idx`
- `UNIQUE (slug)` — `services_slug_unique_idx` (slug is **globally unique**; two hosts cannot share a slug, even across different hosts)
- `idx_services_prof_cat (primary_category, category) WHERE category IS NOT NULL` — v3.60, PENDING both DBs

**Constraints (v3.60, PENDING both DBs):**
- `fk_services_category FOREIGN KEY (primary_category, category) REFERENCES service_categories(primary_category, slug) ON UPDATE CASCADE ON DELETE RESTRICT` — composite FK; makes cross-profession `(category, primary_category)` pairings unrepresentable. `ON UPDATE CASCADE` repoints services when an admin renames a slug; `ON DELETE RESTRICT` backstops the app-side "in use" 409.
- `chk_category_pair CHECK ((category IS NULL) = (primary_category IS NULL))` — closes the `MATCH SIMPLE` hole (a composite FK ignores rows where any column is NULL): both columns are NULL together or set together.

**RLS:**
- SELECT: `is_active = true`
- INSERT/UPDATE/DELETE: `auth.uid() = host_id`

---

### service_categories
Profession-scoped service category catalog (v3.53). One row per (profession, slug) pair; `slug` is the value stored on `services.category`.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| primary_category | TEXT | Profession slug this category belongs to |
| slug | TEXT | Category slug (unique per profession) |
| name | TEXT | Display label |
| display_order | INTEGER | NOT NULL DEFAULT 0 -- sort position within the profession (v3.53) |
| is_active | BOOLEAN | NOT NULL DEFAULT true -- inactive rows hidden from picker + public pages (v3.53) |
| description | TEXT | v3.60, PENDING both DBs — SEO copy for `/services/:profession` |
| icon | TEXT | v3.60, PENDING both DBs — icon key for `professionIcons.js` |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() (v3.53) |

**Constraints (v3.60, PENDING both DBs):**
- `fk_sc_primary FOREIGN KEY (primary_category) REFERENCES categories(slug) ON UPDATE CASCADE ON DELETE RESTRICT` — a category's profession must be a real, live profession.

**Seed:** `server/config/serviceCategorySeed.js` (10 professions, entries as `string | {name, description}`) via `server/scripts/seedServiceCategories.js`; gap-fills `description` where NULL — re-run on both DBs after v3.60 applies.

---

### availability
One row per host. JSONB schedule.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| host_id | UUID FK UNIQUE | → `profiles(id)` |
| weekly_schedule | JSONB | `{ monday: [{start,end},...], ... }` |
| blocked_dates | JSONB | Array of ISO date strings |
| timezone | TEXT | Default `'Asia/Kolkata'` |
| buffer_minutes | INTEGER | Gap between bookings |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**RLS:**
- SELECT: public
- INSERT/UPDATE: `auth.uid() = host_id`

---

### bookings
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| service_id | UUID FK | → `services(id)` |
| host_id | UUID FK | → `profiles(id)` |
| guest_id | UUID FK nullable | → `profiles(id)` (null for unregistered guests) |
| guest_name | TEXT | |
| guest_email | TEXT | |
| guest_phone | TEXT | |
| scheduled_at | TIMESTAMPTZ | UTC |
| status | TEXT | `'pending'` \| `'confirmed'` \| `'cancelled'` \| `'completed'` \| `'no_show'` (v3.45) |
| payment_status | TEXT | `'unpaid'` \| `'paid'` \| `'refunded'` |
| payment_id | TEXT | Razorpay payment ID |
| meeting_link | TEXT | Google Meet URL |
| notes | TEXT | Guest notes |
| vendor_amount | NUMERIC | Pricing snapshot: vendor payout |
| platform_fee_amount | NUMERIC | Pricing snapshot: platform fee |
| commission_applied | NUMERIC | Pricing snapshot: commission (v1.7 — applied live) |
| customer_total | NUMERIC | v2.2 money model: service + platform fee + GST (amount charged online) |
| platform_fee_gst | NUMERIC | v2.2: 18% GST on the platform fee |
| gst_rate | NUMERIC | v2.2: GST rate snapshot (default 0.18) |
| razorpay_fee_actual | NUMERIC | v2.2: actual Razorpay fee at capture (vendor-borne, excl tax) |
| end_at | TIMESTAMPTZ | v2.5: session end; backs the `bookings_no_overlap` exclusion constraint |
| google_event_id | TEXT | Google Calendar event id (online bookings) |
| reminder_24h_sent | BOOLEAN | |
| reminder_1h_sent | BOOLEAN | |
| reschedule_status | TEXT | `'none'` \| `'awaiting_guest_ack'` \| `'acknowledged'` |
| reschedule_ack_token | TEXT | One-time token for guest acknowledgement |
| reschedule_acknowledged_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**RLS:**
- SELECT: `auth.uid() = host_id OR auth.uid() = guest_id`
- INSERT: public (anyone can book)
- UPDATE: `auth.uid() = host_id OR auth.uid() = guest_id`

---

### otp_codes
Booking OTP + password reset OTP storage.
| Column | Type | Notes |
|---|---|---|
| email | TEXT PK | Normalized (lowercase, trimmed) |
| otp | TEXT | 6-digit string |
| phone | TEXT | Optional, default '' |
| type | TEXT | `'booking'` \| `'password_reset'` (default 'booking') |
| expires_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

**RLS:** `deny_all` policy — only supabaseAdmin can access.

---

### plan_purchases
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| vendor_id | UUID FK | → `profiles(id)` |
| plan | TEXT | `'creator'` \| `'professional'` |
| amount | NUMERIC | |
| razorpay_payment_id | TEXT | |
| purchased_at | TIMESTAMPTZ | |

---

### payout_requests
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| host_id | UUID FK | → `profiles(id)` |
| amount | NUMERIC(10,2) | |
| status | TEXT | `'pending'` \| `'approved'` \| `'rejected'` |
| created_at | TIMESTAMPTZ | |
| processed_at | TIMESTAMPTZ | |

---

### products
Digital downloadable products.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| host_id | UUID FK | → `profiles(id)` |
| title | TEXT | |
| description | TEXT | |
| price | NUMERIC | 0 = free |
| file_url | TEXT | Supabase Storage or signed URL |
| thumbnail_url | TEXT | |
| is_active | BOOLEAN | |
| purchase_count | INTEGER | Incremented via DB function |
| created_at | TIMESTAMPTZ | |

---

### product_purchases
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| product_id | UUID FK | → `products(id)` |
| buyer_email | TEXT | |
| buyer_phone | TEXT | |
| buyer_name | TEXT | |
| amount | NUMERIC | |
| razorpay_payment_id | TEXT | |
| download_token | TEXT UNIQUE | Time-limited download link |
| download_expires_at | TIMESTAMPTZ | |
| purchased_at | TIMESTAMPTZ | |

---

### reviews
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| booking_id | UUID FK UNIQUE | → `bookings(id)` |
| host_id | UUID FK | → `profiles(id)` |
| guest_name | TEXT | |
| rating | INTEGER | 1-5 |
| comment | TEXT | |
| created_at | TIMESTAMPTZ | |

---

### app_settings
Key-value store for admin-configurable platform settings.
| Column | Type | Notes |
|---|---|---|
| key | TEXT PK | e.g. `'plan_price_creator'`, `'plan_limits'` |
| value | TEXT | JSON-encoded string |

**Seeded values:**
- `plan_price_creator` = `'99900'` (paise)
- `plan_price_professional` = `'365000'` (paise)
- `plan_limits` = JSON of plan limits

---

## Database Functions
| Function | Purpose |
|---|---|
| `handle_new_user()` | Trigger: auto-create profile on auth.users insert |
| `increment_product_purchase_count(uuid)` | Atomic increment of `products.purchase_count` |
| `post_journal_entry(jsonb)` | **Atomic double-entry posting** (v2.8). SECURITY DEFINER, service-role only (REVOKEd from anon/authenticated). Validates balance (Σdebit = Σcredit, ≥2 lines), is idempotent on `(source_type, source_id)`, writes `journal_entries` + `journal_lines`, then per line updates `account_balances` under row lock (normal-balance sign: ASSET/EXPENSE grow on debit, LIABILITY/REVENUE on credit) and appends a `ledger_entries` row with `balance_after_account`. Returns `journal_entry_id`. Input: `{ source_type, source_id, description?, journal_date?, created_by?, lines:[{account_code, debit\|credit, vendor_id?, order_item_id?, subscription_payment_id?}] }`. Hardened in v2.8.1 (ordered locks, immutability triggers). |

---

## Migration History
| Version | Key Change |
|---|---|
| schema.sql | Base tables: profiles, services, availability, bookings |
| v1.1 | otp_codes table |
| v1.2 | profiles.plan + plan_purchases table |
| v1.3 | services.grace_period_minutes, slug, thumbnail_url, otp_codes.type |
| v1.4 | payout_requests table |
| v1.5 | increment_product_purchase_count function |
| v1.6 | Catch-up: all profile columns (google tokens, razorpay, cover_image etc) |
| v1.7 | bookings.commission_applied column (applied live) |
| v1.9 | notification_providers, notification_events, notification_logs; otp_codes hardening |
| v2.0–v2.5 | badges, plans, payout model, email engine, admin RBAC, Google auth/availability |
| v2.6 | **Campaign platform:** `contacts`, `segments`, `email_campaigns`, `campaign_recipients`; `email_logs.campaign_id` |
| v2.7 | **WhatsApp campaigns:** `whatsapp_templates`; `email_campaigns.whatsapp_template_id` |
| v2.8 | **Financial ledger P1:** `chart_of_accounts` (12 seeded), `journal_entries`, `journal_lines`, `ledger_entries`, `account_balances`, `subscription_payments`; +10 `bookings` columns; `post_journal_entry(jsonb)` RPC; all RLS deny-all (applied live) |
| v2.8.1 | Ledger hardening: ordered account locks, idempotency-race handling, journal/ledger immutability triggers, ledger amount CHECK (applied live) |
| v2.8.2 | Partial unique index on `subscription_payments.razorpay_payment_id` (applied live) |
| v3.60 | **Service category integrity** (`v3.60_service_category_integrity.sql`) — `services.primary_category` + composite FK `fk_services_category` → `service_categories(primary_category, slug)`; CHECK `chk_category_pair`; FK `fk_sc_primary` on `service_categories.primary_category` → `categories(slug)`; partial index `idx_services_prof_cat`; `service_categories.description`/`.icon`; backfill + orphan cleanup. **PENDING both DBs** |

---

## Campaign Platform Tables (v2.6 / v2.7) — applied live

- **contacts** — consented, contactable audience synced from `profiles`+`bookings`+`product_purchases`. Cols: `email` (unique), `phone`, `name`, `user_id`, `contact_type` (vendor|guest|buyer), `email_opt_in`, `whatsapp_opt_in`, `email_suppressed`, `whatsapp_suppressed`, `attributes` JSONB, `source`, `last_synced_at`. Service-role RLS.
- **segments** — saved filter: `definition` JSONB `{ contact_type?, filters:[{field,op,value}] }`, `is_system`. 4 system seeds.
- **email_campaigns** — campaign object (holds email **and** WhatsApp; name is historical). `channel`, `segment_id`, `template_id` (email), `whatsapp_template_id`, `subject_override`, `status` (draft|scheduled|sending|sent|paused|failed), `scheduled_at`, `throttle_per_min`, `stats` JSONB.
- **campaign_recipients** — per-recipient queue: `campaign_id`, `contact_id`, `channel`, `destination`, `status` (queued|sent|failed|skipped), `email_log_id`, `sent_at`.
- **whatsapp_templates** — approved AiSensy templates: `aisensy_campaign_name`, `language`, `body_preview`, `variable_map` JSONB ({"1":"first_name",…}), `param_count`, `approval_status`, `is_active`.

Full design: `docs/communication-campaigns-architecture.md`.

---

## Financial Ledger Tables (v2.8 / v2.8.1 / v2.8.2) — applied live

Double-entry accounting (P1 Ledger Core). All tables RLS **deny-all** (service-role only). Ledger/journal tables are append-only and written exclusively through the `post_journal_entry(jsonb)` RPC (see Database Functions). Money model **v3**. Spec: `docs/superpowers/specs/2026-06-13-financial-ledger-p1-design.md`.

### chart_of_accounts
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| code | TEXT UNIQUE | e.g. `'1000'`, `'4100'` |
| name | TEXT | |
| type | TEXT | `ASSET` \| `LIABILITY` \| `REVENUE` \| `EXPENSE` |
| active | BOOLEAN | default true |
| created_at | TIMESTAMPTZ | |

**12 seeded accounts:** 1000 Bank, 1100 Razorpay Receivable, 2000 Vendor Payables, 2100 GST Payable, 2200 Refund Liability, 4000 Platform Fee Revenue, 4100 Commission Revenue, 4200 Subscription Revenue, 5000 Razorpay Charges (Orders), 5100 Razorpay Charges (Subscriptions), 5200 Settlement Charges, 5300 Refund Losses.

---

### journal_entries
One per business event; UNIQUE `(source_type, source_id)` = idempotency key.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| journal_number | TEXT UNIQUE | `JNL-YYYY-NNNNNN` (from `journal_number_seq`) |
| journal_date | DATE | default CURRENT_DATE |
| source_type | TEXT | `ORDER_PAYMENT` \| `SUBSCRIPTION_PAYMENT` \| `SETTLEMENT` \| `REFUND` \| `ADJUSTMENT` \| `REVERSAL` \| `BANK_TRANSFER` \| `BACKFILL` \| `BACKFILL_SETTLEMENT` |
| source_id | UUID | e.g. booking id / subscription_payment id |
| description | TEXT | |
| created_by | UUID | `admin_users.id`; NULL = system |
| created_at | TIMESTAMPTZ | |

---

### journal_lines
Balanced debit/credit lines per entry (each line: exactly one of debit/credit > 0).
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| journal_entry_id | UUID FK | → `journal_entries(id)` |
| account_id | UUID FK | → `chart_of_accounts(id)` |
| debit | NUMERIC(12,2) | ≥ 0 |
| credit | NUMERIC(12,2) | ≥ 0 |
| vendor_id | UUID | |
| order_id | UUID | future cart structure; NULL today |
| order_item_id | UUID | = `bookings.id` today |
| subscription_payment_id | UUID | |
| created_at | TIMESTAMPTZ | |

---

### ledger_entries
Append-only running-balance log; written ONLY by the RPC.
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| created_at | TIMESTAMPTZ | clock_timestamp ordering (v2.8.1) |
| account_id | UUID FK | → `chart_of_accounts(id)` |
| order_id | UUID | |
| order_item_id | UUID | |
| vendor_id | UUID | |
| subscription_payment_id | UUID | |
| journal_entry_id | UUID FK | → `journal_entries(id)` |
| ledger_type | TEXT | `DEBIT` \| `CREDIT` |
| debit | NUMERIC(12,2) | |
| credit | NUMERIC(12,2) | |
| balance_after_account | NUMERIC(14,2) | account balance after this line |

---

### account_balances
One row per account; updated under row lock inside the RPC (auto-seeded).
| Column | Type | Notes |
|---|---|---|
| account_id | UUID PK | → `chart_of_accounts(id)` |
| balance | NUMERIC(14,2) | default 0 |
| updated_at | TIMESTAMPTZ | |

---

### subscription_payments
Records each vendor plan charge (PRD §5.4). Partial unique index on `razorpay_payment_id` (v2.8.2).
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| vendor_id | UUID | |
| plan_type | TEXT | |
| plan_price | NUMERIC(12,2) | |
| gst_amount | NUMERIC(12,2) | 18% of plan price |
| total_charged | NUMERIC(12,2) | plan_price + gst |
| razorpay_fee | NUMERIC(12,2) | platform-borne (expense) |
| razorpay_tax | NUMERIC(12,2) | |
| razorpay_payment_id | TEXT | partial-unique (v2.8.2) |
| razorpay_order_id | TEXT | |
| razorpay_subscription_id | TEXT | NULL until P5 (recurring mandate) |
| paid_at | TIMESTAMPTZ | |
| revenue_recognized_at | TIMESTAMPTZ | |
| billing_period_start / _end | DATE | |
| status | TEXT | default `'paid'` |
| created_at | TIMESTAMPTZ | |

---

### bookings — new ledger columns (v2.8)
Added to the existing `bookings` table (old rows keep original snapshots):
| Column | Type | Notes |
|---|---|---|
| paid_at | TIMESTAMPTZ | stamped on verifyPayment |
| completed_at | TIMESTAMPTZ | stamped on completeBooking |
| revenue_recognized_at | TIMESTAMPTZ | |
| settled_at | TIMESTAMPTZ | P2 |
| commission_gst | NUMERIC(12,2) | 18% of commission, vendor-borne (money model v3) |
| razorpay_tax_actual | NUMERIC(12,2) | fee stored split (fee_actual + tax_actual) |
| commission_percentage | NUMERIC(5,2) | snapshot |
| vendor_plan_type | TEXT | snapshot |
| settlement_status | TEXT | default `'pending_completion'`; → `eligible_for_settlement` \| `not_eligible` on complete |
| revenue_recognition_status | TEXT | default `'pending'`; → `recognized` on complete |

---

## Migration Status Log (moved from CLAUDE.md, 2026-11-28)
Per-migration applied/pending record with verification notes. Newest state wins where entries disagree; the 2026-11-17 "Live state re-verified" entry overrides older ones. Add every new migration here, not in CLAUDE.md.

All migrations through **v3.57 are APPLIED** on both prod (Mumbai `PROD_PROJECT_REF`)
and staging (Tokyo `STAGING_PROJECT_REF`), verified by live schema introspection.
Items previously listed here as pending are now live:
- **v1.7** (`bookings.commission_applied`) — applied.
- **v3.53** (profession-scoped `service_categories` redesign + `seedServiceCategories.js`) — applied.
- **v3.57** (two partial `bookings` indexes for host paid-booking reads) — applied 2026-07-01.

- **v3.81** (`v3.81_host_documents_permissions.sql`) — applied 2026-07-16 on BOTH DBs and
  verified: `operations` now holds `documents.view` / `documents.manage` (32 → 34 perms,
  matching `lib/adminPermissions.js` exactly); `support` deliberately holds neither; `super`
  is wildcard and untouched. Takes effect on each admin's NEXT login (permissions are
  embedded in the admin JWT at sign-in — an ops admin logged in before this still 403s on
  host documents until they re-login).

- **v3.88** (`v3.88_profiles_og_card.sql`) — applied 2026-07-19 on BOTH DBs (prod 59
  profiles + staging 7 defaulted to og_status='none'). Adds host OG share-card columns
  (og_image/og_status/og_generated_at/og_version/og_hash/og_error) + status check +
  partial pending index. Code keeps a schema fallback (hostController strips og_status
  on "column not found"). Cards generated off-Render via `client/scripts/generateHostOgImages.mjs`
  (blog pipeline clone) → Supabase images/host-og/.

- **v3.89** (`v3.89_bot_escalations.sql`) — applied 2026-07-20 on BOTH DBs. Adds
  `bot_escalations` + `bot_escalation_replies` (Tithi, formerly Bolt, human-handoff records + admin reply
  thread; additive, RLS-on/no-policy/service_role-only). escalationService keeps the
  code-side schema fallback (degrades to email-only on "table/column missing"). See
  `docs/bolt-escalation-flow.md`.

- **v3.90** (`v3.90_bot_escalation_rating.sql`) — applied 2026-07-20 on BOTH DBs. Adds
  `bot_escalations.rating` (1–5 post-handoff satisfaction). Additive, schema-fallback safe.

- **Host notification system** (audit "Host Signal", PRs #855–#859) — applied 2026-08-29 on
  BOTH DBs via Supabase MCP and verified identical (prod `PROD_PROJECT_REF` + staging
  `STAGING_PROJECT_REF`). All additive + schema-fallback safe in `utils/inAppNotify.js`:
  - **`v3.130_notification_in_app_channel.sql`** — `notification_events.in_app_enabled`
    (in-app becomes a NotificationEngine channel) + seeds `SUBSCRIPTION_HALTED` and
    `REFERRAL_REWARD_RELEASED` event rows. **Filename note:** number collides with
    `v3.130_merge_lead_rows_fn.sql` (CRM) — cosmetic only, both applied, Supabase names
    migrations independently. Also seeded 2 matching `email_templates` rows (audience
    `vendor`) via `scripts/seedEmailTemplates.js` shape.
  - **`v3.131_in_app_notifications_dedupe.sql`** — `in_app_notifications.dedupe_key` +
    partial unique index `(user_id, dedupe_key)` (stops reconciler/cron double-inserts).
  - **`v3.132_in_app_notifications_resolution.sql`** — `in_app_notifications.resolved_at`
    (a notice self-clears once the host fixes the problem; `resolveInApp` wires KYC-approved
    → clears `KYC_REJECTED`, subscription charge → clears `SUBSCRIPTION_HALTED`).

- **Relationship engine Phase 2** (audit follow-on, PRs #925/#927/#928/#931/#936) — merged 2026-09-02.
  Only PR-9 needed a migration; the rest are code-only (governor, health signals, sends-proof, two-clock):
  - **`v3.139_touch_rec_guest_subject.sql`** — applied 2026-09-02 on BOTH DBs (staging Tokyo
    `STAGING_PROJECT_REF` first, then prod Mumbai `PROD_PROJECT_REF`) via Supabase MCP and
    verified identical (10 columns present on each): `touch_recommendations.contact_id` (FK
    contacts, ON DELETE CASCADE) lets a guest rec set `subject_type='guest'` + `contact_id` with a
    null `lead_id`; `contacts` gains the same touch-clock columns as leads' v3.133
    (`last_meaningful_interaction_at` / `last_meaningful_channel` / `meaningful_interaction_count` /
    `last_automated_touch_at` / `last_activity_at`) and the health columns from v3.135
    (`health_state` CHECK + `health_score` / `health_signals` / `health_computed_at`). Additive,
    RLS unchanged (service-role only). Code is schema-fallback safe (`guestRelationshipEngine`
    skips the health write, `deskService` guest query fails soft) so it was safe before apply.
  - **CRM is OFF until 2027-01-01 (founder decision 2026-11-26).** `crm_admin_sends` was flipped
    **OFF** on 2026-11-26, and the new `crm_automation` flag (ships OFF, fail-closed, PR #454) gates
    EVERY CRM background job — attribution, lifecycle + guest engines, list engagement, second-touch,
    send queue, sequence steps, follow-up + cold-call reminders, cold-call recap. Turn both back on in
    Admin → Feature flags in January. The CRM admin pages and manual cold calling work with them off.
  - **`crm_admin_sends` — the CRM master send switch.** On the current Meeticulous DB
    (`spquowzrefozmrzoszkf`) it was **ON** from 2026-11-12 until 2026-11-26 (see the line above; on 2026-11-01 it was OFF and no CRM email had
    been sent from this DB). The history below is from the old Mumbai/Tokyo DBs: it was enabled on
    prod Mumbai since 2026-08-27 (~100+ real messages) and staging Tokyo since 2026-09-02.
    When it is ON: Phase 2 is therefore NOT advisory-only on
    prod — the governor cap (1/48h per subject), quiet-hours (09–20 IST), do-not-contact and
    email/WhatsApp opt-out gates are the live guardrails on every send (see `sendGate`/`touchGovernor`).
    To pause all CRM sends instantly: `UPDATE feature_flags SET enabled=false WHERE key='crm_admin_sends'`
    (fail-closed; effective within the 60s flag cache). Runbook + flip history in `docs/current-work.md`.

- **v3.180** (`v3.180_remove_old_brand.sql`) — applied 2026-11-01 on the Meeticulous DB
  (`spquowzrefozmrzoszkf`, the only DB reachable now): old brand removed from 98 published blogs,
  6 CRM templates, a badge slug and 5 column defaults; lead status `'customer'` added (transitional —
  the old value is still accepted). `bot_faqs` re-synced from `botFaqs.json` the same day.
- **v3.181** (`v3.181_drop_old_lead_status.sql`) — applied 2026-11-01 after the release went live on
  Render: `leads_status_check` + `merge_lead_rows` now carry only `'customer'`.
- **v3.182** (`v3.182_crm_cold_senders.sql`) — applied 2026-11-01 and **activated**: CRM mail to
  leads sends via Brevo from `crm_shubham` ("Shubham | CEO, Meeticulous" <shubham@mail.meeticulous.in>,
  cold outreach on the separate `.in` root; replies → shubham@meeticulous.com) and `crm_tithi`
  ("Tithi at Meeticulous" <tithi@news.meeticulous.com>, lifecycle to opted-in hosts, kept OFF the cold
  root; replies → team@meeticulous.com). Brevo-authenticated domains: `mail.meeticulous.in`,
  `news.meeticulous.com` — NOT `team.meeticulous.com` (Resend only), so a CRM sender must never point
  there. Durga/Sujata have no sender rows: their sequence steps were moved to Tithi (2026-11-01).
  Only takes effect while `crm_admin_sends` is ON. Off switch: `UPDATE email_senders SET active=false
  WHERE sender_key IN ('crm_shubham','crm_tithi');`.
- **v3.183** (`v3.183_lead_reply_intent.sql`) — applied 2026-11-02 on the Meeticulous DB:
  `leads.last_reply_intent` (AI label on the latest CRM email reply, written by
  `brevoInboundController` via Brevo inbound parsing on `reply.meeticulous.in`).
- **v3.184** (`v3.184_founding_plan.sql`) — applied 2026-11-03 on the Meeticulous DB after release #116
  shipped: archived `premium_founding` plan row (copy of Pro at today's price; Pro checkouts land there
  while founding spots are open), `vendor_metrics.is_founding_member` + automatic "Founding Member" badge,
  phantom `subscription_plans.features` keys dropped. Email templates reseeded the same day (Pro Taste ×3
  + FOUNDING_SPOTS_LOW inserted, 22 refreshed to the banner designs; all 54 md5-match `config/emailTemplates.js`).
- **v3.185** (`v3.185_platform_reviews.sql`) — applied 2026-11-03 on the Meeticulous DB and verified
  (14 cols, RLS on / no policies, checks + 2 indexes): `platform_reviews` = reviews OF Meeticulous from
  `/submit-review` (one per signed-in account). Public only when `status='approved'` AND
  `consent_public`; approved in Admin → Content → Testimonials (`cms.manage`).
- **v3.185** (`v3.185_community.sql`, community) — applied 2026-11-03 on the Meeticulous DB (founder-approved):
  18 `community_*` tables (schema for ALL community phases), counter triggers, 5 seeded spaces,
  3 `COMMUNITY_*` notification_events. RLS on, no policies. The 3 matching `email_templates` rows were
  inserted on their own (NOT via `seedEmailTemplates.js`, which overwrites every template). All four
  `community*` flags ship OFF + fail-closed.
  **Filename note:** number collides with `v3.185_platform_reviews.sql` — cosmetic only, both applied
  (Supabase names migrations independently; this one is `v3_185_community`).
- **v3.186** (`v3.186_lockdown_anon_rpc_and_views.sql`) — applied 2026-11-03 on the Meeticulous DB
  (founder-approved, verified + advisor clean): revoked anon/authenticated EXECUTE on all 13 `SECURITY
  DEFINER` functions (service_role only) and made `host_activation` / `host_activation_funnel` /
  `vendor_metrics` `security_invoker` with no anon/auth access — before this the public anon key could
  read every host's name/email/phone via `host_activation`. New postgres-owned functions no longer get
  anon EXECUTE by default: **a function the browser must call needs an explicit GRANT**, and every new
  view must set `security_invoker = true` (guarded by `tests/unit/lockdownAnonRpcMigration.test.js`).
- **v3.187** (`v3.187_email_template_seed_hash.sql`) — applied 2026-11-03 on the Meeticulous DB:
  `email_templates.seed_hash` (nullable). Production boot runs `services/email/templateSync.js`, which
  pushes `config/emailTemplates.js` copy into the DB and KEEPS rows edited in the admin editor
  (row content ≠ its seed_hash). Off switch: `EMAIL_TEMPLATE_SYNC=off`. Manual: `node scripts/seedEmailTemplates.js [--force]`.
- **Live state re-verified 2026-11-17 (read-only query against the live DB) — where an older entry
  disagrees, this wins.**
  **Everything is now ON.** The seven nudge tracks — `activation_nudges`, `dormant_nudges`,
  `review_nudges`, `festival_nudges`, `human_moments`, `empathy_track`,
  `community_email_onboarding` — were switched back on after `utils/notificationDedupe.js` shipped
  and was wired into the nudge services themselves (activationNudges, dormancyNudges, empathyScans,
  festivalGreetings, community/onboardingSequence), which was the condition for re-enabling them.
  **These send real email and WhatsApp.** Rollback: set the keys back to `false`.
  `community_v2`, `community_ads` and `coupons` are ON too. Founder decision: test in prod.
  `tds_tcs_v2` is ON (2026-11-17) — see its own entry below; with it OFF the legacy flat 1% + 1%
  ignored `hasGstin` and would have taken GST TCS from hosts with no GSTIN to credit it to.
  Applied: v3.188, v3.199, v3.200, v3.201, v3.205, **v3.204_coupons (2026-11-17)**.
  **Not applied:** v3.191, `v3.203_admin_token_version` (admin session revocation is inert until it is).
  Open findings from the 2026-11-12 audit: `docs/audit-2026-11-12.md`.
- **Open security gap found 2026-11-17 (not fixed):** 149 public tables still grant `TRUNCATE` to
  `anon` and `authenticated`. v3.206 revoked INSERT/UPDATE/DELETE but not TRUNCATE, and RLS does not
  cover TRUNCATE. Not currently reachable — PostgREST exposes no TRUNCATE verb, so the publishable
  key has no route to it — but it is the same posture v3.206 set out to close and wants a follow-up
  migration. The second half of this finding — `increment_coupon_redemption` (v3.204) being
  SECURITY DEFINER with no `SET search_path` — is **FIXED** by v3.221 below.
- **v3.188** (`v3.188_host_linkedin_login_flag.sql`) — applied (confirmed 2026-11-12). Was listed PENDING: apply before/at merge of the LinkedIn
  host login release: seeds the `host_linkedin_login` flag OFF (`ON CONFLICT DO NOTHING`). The registry
  entry also carries `enabled: false`, so a boot before the migration still creates it OFF.
- **v3.189** (`v3.189_maroon_color_defaults.sql`) — applied 2026-11-04 on the Meeticulous DB and verified:
  `profiles.theme_color` + `email_settings.brand_color` defaults `#FE5100` (old orange) → `#960D32`;
  the 3 profiles + 1 email_settings row still on orange repainted.
- **v3.190** (`v3.190_plan_gifts.sql`) — applied 2026-11-04 on the Meeticulous DB and verified (24 cols,
  RLS on / no policies, 7 checks, 3 FKs, partial unique index = one active gift per host):
  `plan_gifts` = gifted (complimentary) Pro from the super admin (`planGiftService`, PR #138) + 3
  `notification_events` (`PLAN_GIFT_RECEIVED/ENDING/ENDED`, email + in-app on, WhatsApp OFF until
  the AiSensy templates are approved). A gift is plain `premium` with `plan_expires_at` = gift end.
  share_*/forward_* columns are for PR C (share-to-extend, pay-it-forward), unused until then.
- **v3.191** (`v3.191_support_sla.sql`) — **PENDING**, apply at merge of the support SLA nudge:
  `support_threads.sla_waiting_since` (set by a trigger on entering `waiting`) + `sla_alerted_clock` /
  `sla_alerted_level`. Additive. Until applied the `support-sla-nudge` job fails closed and sends nothing.

- **v3.206** (`v3.206_lockdown_anon_writes.sql`) — applied 2026-11-12 on the Meeticulous DB
  (`spquowzrefozmrzoszkf`) and verified (0 INSERT/UPDATE/DELETE grants remain for `anon`/`authenticated`).
  Project-audit C1 fix: REVOKEs write on all public tables from anon/authenticated + sets that as the
  default privilege for future postgres-owned tables, closing a hole where a signed-in user could write
  `plan`/`is_verified`/`payment_status`/payouts straight through the publishable key (browser only uses
  supabase-js for auth+realtime, never PostgREST writes — verified, so no app impact). REVOKE-only, so
  rollback is a re-GRANT; the permissive write POLICIES are left in place (unreachable with no grant).
  Companion to v3.205 (profiles column SELECT) + v3.186 (functions + views). Shipped with PR #292.
- **v3.221** (`v3.221_coupon_fn_search_path.sql`) — applied 2026-11-17 on the Meeticulous DB
  (`spquowzrefozmrzoszkf`) and verified: `increment_coupon_redemption` now pins
  `search_path = public, pg_temp`. Closes the open finding above. It was the ONLY one of 15
  `SECURITY DEFINER` functions in `public` with a mutable path (measured, not assumed). Such a
  function runs as its OWNER, so whatever the CALLER's search_path resolves `coupons` to is what
  runs with owner rights. **pg_temp is NAMED** because Postgres searches the temp schema FIRST
  whenever pg_temp is absent from the path — so the bare `= public` form used by v3.205 and v3.25
  still permits a temp-table shadow (residual; those two are applied and left alone). Barely
  exploitable today: EXECUTE is postgres + service_role only, and service_role can already write
  `coupons` directly. It matters the day someone grants EXECUTE to `authenticated`, which CAN
  create temp tables. ALTER-only, so body and ACL untouched — grants verified unchanged after.
  Rollback: `ALTER FUNCTION public.increment_coupon_redemption(uuid) RESET search_path;`. Guarded:
  `tests/unit/lockdownAnonRpcMigration.test.js` now fails ANY `SECURITY DEFINER` definition in a
  migration from v3.186 on that does not pin search_path. Shipped with PR #375.
- **v3.222** (`v3.222_course_fn_search_path.sql`) — applied 2026-11-17 on the Meeticulous DB and
  verified (`search_path=public, pg_temp`; still SECURITY INVOKER; `courses` untouched; every
  function we own now pins its path, 0 remaining).
  Pins `increment_course_purchase_count`, the last entry in the Supabase
  `function_search_path_mutable` lint. NOT v3.221's risk class: this one is SECURITY INVOKER, runs
  with the caller's own rights, no privilege escalation — it is fixed so the lint reads zero and the
  next finding in it is a real one. Of 338 unpinned functions in `public`, 337 are extension-owned
  (btree_gist, pg_trgm and vector are all installed in public — a separate, lower advisor warning);
  exactly one was ours.
- **v3.225** (`v3.225_membership_charges.sql`) — applied 2026-11-19 on the Meeticulous DB
  (`spquowzrefozmrzoszkf`) and verified: 37 columns, 7 indexes, RLS ON with no policies, 0
  anon/authenticated INSERT/UPDATE/DELETE grants (v3.206 default privileges held), 0 rows.
  `membership_charges` = one row per successful membership charge. Until it existed, a charge
  left NO trace: the webhook moved `current_period_end` forward and dropped the payment entity,
  so membership revenue was invisible to `routeAutoPayoutService` (needs a payment id),
  `settlementService` (sums `bookings.vendor_amount`), `withholdingReportService` and
  `gstExportService` — all of which read rows. The payout gap was a RECORD gap.
  Money snapshot comes from `lib/pricingEngine` (same engine as bookings), so commission and
  TDS/TCS match for the same host. No platform fee on top — the tier price is what Razorpay
  bills — so `platform_fee_amount` is 0 and `customer_total` is the amount charged. Unique
  indexes on `razorpay_payment_id` / `razorpay_order_id` are the idempotency guard: a duplicate
  row would later become a duplicate payout. Additive; `services/membershipCharges.js` keeps a
  schema fallback and swallows write failures, so bookkeeping can never cost a member the
  access they paid for. **This records money; it does not move any** — the Route rail,
  settlement/statutory reads and refund reversal are the next slices (PR #405).
- **v3.226** (`v3.226_community_post_collaborators.sql`) — applied 2026-11-21 on the Meeticulous DB
  (`spquowzrefozmrzoszkf`) and verified (5 cols, RLS ON / no policies, 3 indexes = PK + unique
  `(post_id, profile_id)` + `profile_id`, 2 cascade FKs, `COMMUNITY_COLLABORATOR_ADDED` event seeded
  in_app=true/email=false). `community_post_collaborators` = up to 2 credited collaborators per
  community post (instant credit + in-app notify; shown on the post and on each collaborator's
  profile feed). Cap-2 + self-exclusion live in `communityController.createItem`, not the DB. Shipped
  with PR #412 behind `community_collaborators` (ships OFF). Code is schema-fallback safe
  (`store.loadCollaboratorsByPost` / `listAuthorPosts` degrade to empty/author-only), so the migration
  was safe to apply before the code deploys. Only takes effect once the flag is flipped.
- **v3.217** (`v3.217_creator_intelligence.sql`) — applied 2026-11-18 on the Meeticulous DB
  (`spquowzrefozmrzoszkf`) and verified: the 5 Creator Intelligence tables (`analytics_events`,
  `analytics_daily`, `analytics_daily_dim`, `booking_attribution`, `benchmark_daily`), the
  `profiles.intel_revenue_target` column, RLS ON all 5 (no policies, service_role only — v3.186/v3.206
  posture), and anon/authenticated REVOKED. Additive; code is schema-fallback safe (intel-rollup /
  intel-prune wrap each day in try/catch and no-op on a missing table), so it was safe to ship on
  release/2026-11 before apply. Intel stays dark until `analytics_ingest` is flipped ON (ships OFF:
  the collect endpoint returns 202 and drops). Shipped with PRs #366 (foundation) / #367 / #371.
- **v3.218** (`v3.218_analytics_size_fn.sql`) — applied 2026-11-18 on the Meeticulous DB and verified
  (fn executes, returned 40960 bytes): `analytics_events_size_bytes()` (SECURITY DEFINER, pins
  `search_path = public, pg_catalog`, EXECUTE granted to service_role ONLY). Feeds the ingest size
  guard, sampled by intel-rollup/intel-prune, never called on the ingest path. **Filename note:**
  number collides with `v3.218_community_membership.sql` (membership) — cosmetic only, both applied,
  Supabase names migrations independently. Shipped with PR #371.
- **v3.227** (`v3.227_catalog_sort_order.sql`) — applied 2026-11-26 on the Meeticulous DB
  (`spquowzrefozmrzoszkf`, founder-approved) and verified: nullable `sort_order integer` (no
  default) on `services` / `products` / `courses` + `idx_{table}_host_sort (host_id, sort_order)`;
  still 0 anon/authenticated write grants. The host-set Catalog order (Kept Catalog reorder,
  `PUT /api/{services,products,courses}/reorder`). NULL = never placed; every read sorts
  `sort_order NULLS LAST, created_at DESC` (`services/catalogOrder.js`), so untouched hosts keep
  newest-first. Code is schema-fallback safe (order read in its own query; reorder answers 409
  without the column). Rollback: `ALTER TABLE … DROP COLUMN IF EXISTS sort_order` on the three.
- **v3.228** (`v3.228_membership_tier_cover.sql`) — applied 2026-11-27 on the Meeticulous DB
  (`spquowzrefozmrzoszkf`) and verified: `community_membership_tiers.cover_url` + `description`
  (nullable text, `tier_description_len` check ≤ 600). Tier cover + description on the Kept tier
  cards (PR #461). Additive; `membershipController` keeps a schema fallback (writeTier retries
  without the two columns). Rollback: `DROP COLUMN IF EXISTS` on both.
- **v3.229** (`v3.229_clean_catalog_slugs.sql`) — applied (verified 2026-11-27 on the Meeticulous DB:
  `legacy_slugs` present on `products` + `courses`, 0 `demo-` product slugs left). From the profile SEO
  overhaul (`feat/profile-seo-overhaul`). **Filename note:** number collides with `v3.229_pricing_v2.sql`
  (pricing v2) — cosmetic only, both applied. Adds `legacy_slugs text[] NOT NULL DEFAULT '{}'` to
  `products` + `courses` and strips the `demo-` prefix from their slugs (old slug moved into
  `legacy_slugs`; per-host clash → `-2`, `-3`). Idempotent + additive. Old URLs keep resolving:
  `services/catalogSlug.js` looks up slug → id → legacy_slugs and the page / bot shell 301s to
  `/:username/products|courses/<slug>`. Code is schema-fallback safe (no column = the legacy lookup
  is "not found"). Verify + rollback queries are in the file header.
- **v3.229** (`v3.229_pricing_v2.sql`) — applied 2026-11-27 on the Meeticulous DB (`spquowzrefozmrzoszkf`),
  SCHEMA ONLY, and verified: `subscription_plans.commission_rates` (jsonb, all 8 rows NULL) and
  `bookings.platform_fee_gross` (numeric 10,2); no anon/authenticated write grants. Dormant until
  pricing-v2 code reads them (NULL rates → `planService` falls back to `commission_percentage`).
  `bookings.platform_fee_amount` now means the TAXABLE (ex-GST) fee once the fee goes GST-inclusive;
  the applied commission rate keeps living in the existing `bookings.commission_percentage` snapshot.
- **v3.230** (`v3.230_pricing_v2_values.sql`) — applied 2026-11-28 on the Meeticulous DB right after
  release #475 went live, and verified: Pro 168.64 / 1016.10 ex-GST (= ₹199.00 / ₹1,199.00), founding
  761.86 (= ₹898.99), Starter limits crm 50 / reminder_flows 2 / followup_flows 1 / categories 1 /
  digital_products -1, `commission_rates` on free + Pro rows, `insights:-1` on Pro + legacy paid, and the
  free rows' `commission_percentage` scalar 5 → 9 (the upgrade page and onboarding print it).
- **v3.231** (`v3.231_purchase_commission.sql`) — applied 2026-11-27 on the Meeticulous DB
  (`spquowzrefozmrzoszkf`) and verified: `commission_percentage` / `commission_applied` (NOT NULL 0) /
  `commission_gst` (NOT NULL 0) / `commission_taxable` on `product_purchases` (54 rows) and
  `course_purchases` (21 rows), all existing rows at 0; no anon/authenticated write grants. Dormant until
  the pricing-v2 code deploys (it writes the product/course commission snapshot).
- **v3.232** (`v3.232_pro_no_appointment_band.sql`) — applied 2026-11-28 on the Meeticulous DB and
  verified: Pro + founding `commission_rates` band keys set to null — founder ruling: no ₹25,000 ceiling,
  Pro is 0% on appointments however much the host earns (goods stay 4%). Band code stays, dormant.
