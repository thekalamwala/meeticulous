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
