# Database — Book A Sloth

Database: **Supabase (PostgreSQL)**. All server queries use `supabaseAdmin` (service role key) which bypasses Row Level Security. RLS enforces client-side access control only.

---

## Fresh Setup Order

Run these SQL files in Supabase SQL Editor, in order:

```
server/config/schema.sql
server/migrations/v1.6_catchup.sql
server/migrations/v1.7_pricing_snapshot.sql   ← ⚠️ required for commission tracking
server/migrations/v1.8_vendor_onboarding.sql
server/migrations/v1.9_notification_system.sql
server/migrations/v2.0_badge_system.sql
server/migrations/v2.1_subscription_plans.sql
server/migrations/v2.2_payout_model.sql
server/migrations/v2.3_email_communication_engine.sql
server/migrations/v2.4_admin_rbac.sql
```

Then seed email templates:
```bash
cd server && node scripts/seedEmailTemplates.js
```

---

## Tables

### profiles
Extends `auth.users`. One row per user (host or guest). Auto-created by trigger on signup.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | References `auth.users(id)` |
| name | TEXT | Display name |
| email | TEXT | |
| role | TEXT | `'host'` \| `'guest'` |
| username | TEXT UNIQUE | URL slug for public profile |
| bio / tagline / profession | TEXT | Profile copy |
| profile_image / cover_image | TEXT | Cloudinary URLs |
| social_links | JSONB | `{ instagram, youtube, linkedin, ... }` |
| theme_color | TEXT | Hex color (plan-gated palette) |
| is_verified | BOOLEAN | Admin-set verification badge |
| is_banned | BOOLEAN | Admin-set ban flag |
| plan | TEXT | `'starter'` \| `'creator'` \| `'professional'` |
| plan_expires_at | TIMESTAMPTZ | Null = no expiry |
| plan_activated_at | TIMESTAMPTZ | Anchor for annual booking limit |
| google_calendar_connected | BOOLEAN | |
| google_access_token / google_refresh_token | TEXT | |
| razorpay_account_id | TEXT | For payouts |
| created_at / updated_at | TIMESTAMPTZ | |

**Trigger:** `on_auth_user_created` → auto-creates profile row on `auth.users` insert.

**RLS:** SELECT = public. UPDATE = `auth.uid() = id`.

---

### services
One service row per host service.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| host_id | UUID FK | → `profiles(id)` |
| title | TEXT | |
| short_description | TEXT | Shown in cards |
| long_description | TEXT | Full detail view |
| type | TEXT | `'one_on_one'` \| `'group'` \| `'paid_dm'` |
| service_type | TEXT | `'online'` \| `'offline'` |
| duration | INTEGER | Minutes |
| price | NUMERIC(10,2) | 0 = free |
| currency | TEXT | Default `'INR'` |
| meeting_mode | TEXT | `'online'` \| `'offline'` |
| thumbnail_url | TEXT | Cloudinary URL |
| grace_period_minutes | INTEGER | Default 10 — overlap buffer |
| slug | TEXT | URL slug, unique per host |
| is_active | BOOLEAN | Default true |
| included_items / excluded_items | JSONB | What's included/excluded |
| faqs | JSONB | FAQ array |
| important_note | TEXT | Disclaimer |
| total_bookings | INTEGER | Cached count |
| created_at / updated_at | TIMESTAMPTZ | |

**Index:** `UNIQUE (host_id, slug)` — services_host_slug_idx

**RLS:** SELECT = `is_active = true`. INSERT/UPDATE/DELETE = `auth.uid() = host_id`.

---

### availability
One row per host. Stores weekly schedule as JSONB.

| Column | Type | Notes |
|---|---|---|
| host_id | UUID FK UNIQUE | → `profiles(id)` |
| weekly_schedule | JSONB | `{ monday: [{start, end}], tuesday: [...], ... }` |
| blocked_dates | JSONB | Array of ISO date strings (`YYYY-MM-DD`) |
| timezone | TEXT | Default `'Asia/Kolkata'` |
| buffer_minutes | INTEGER | Gap between bookings |

**RLS:** SELECT = public. INSERT/UPDATE = `auth.uid() = host_id`.

---

### bookings
Core booking record. Stores full pricing snapshot at booking time.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| service_id / host_id / guest_id | UUID FK | guest_id nullable |
| guest_name / guest_email / guest_phone | TEXT | |
| scheduled_at | TIMESTAMPTZ | UTC |
| status | TEXT | `'pending'` \| `'confirmed'` \| `'cancelled'` \| `'completed'` |
| payment_status | TEXT | `'unpaid'` \| `'paid'` \| `'refunded'` |
| payment_id | TEXT | Razorpay payment ID |
| meeting_link | TEXT | Google Meet URL |
| notes | TEXT | Guest notes |
| vendor_amount | NUMERIC | Snapshot: vendor payout |
| platform_fee_amount | NUMERIC | Snapshot: platform fee |
| commission_applied | NUMERIC | Snapshot: commission (needs v1.7) |
| platform_fee_gst | NUMERIC | Snapshot: GST on platform fee (v2.2) |
| razorpay_fee_actual | NUMERIC | Actual Razorpay fee (v2.2) |
| customer_total | NUMERIC | Total charged to guest (v2.2) |
| gst_rate | NUMERIC | GST rate at time of booking (v2.2) |
| reminder_24h_sent / reminder_1h_sent | BOOLEAN | Cron flags |
| reschedule_status | TEXT | `'none'` \| `'awaiting_guest_ack'` \| `'acknowledged'` |
| reschedule_ack_token | TEXT | One-time token for guest |
| reschedule_acknowledged_at | TIMESTAMPTZ | |
| created_at / updated_at | TIMESTAMPTZ | |

**RLS:** SELECT = `auth.uid() = host_id OR guest_id`. INSERT = public. UPDATE = `host_id OR guest_id`.

---

### otp_codes
Single-use OTP storage for booking verification and password reset.

| Column | Type | Notes |
|---|---|---|
| email | TEXT PK | Normalized lower+trimmed |
| otp | TEXT | bcrypt hash of 6-digit OTP |
| phone | TEXT | Optional |
| type | TEXT | `'booking'` \| `'password_reset'` |
| expires_at | TIMESTAMPTZ | 10-minute TTL |
| attempts | INTEGER | Verify attempts counter |
| send_count | INTEGER | Sends this hour |
| first_send_at | TIMESTAMPTZ | Reset window anchor |
| locked_until | TIMESTAMPTZ | Lockout expiry |
| created_at | TIMESTAMPTZ | |

**RLS:** deny_all — only `supabaseAdmin` can access.

---

### plan_purchases
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| vendor_id | UUID FK | → `profiles(id)` |
| plan | TEXT | Plan name at purchase time |
| amount | NUMERIC | Amount paid |
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
| created_at / processed_at | TIMESTAMPTZ | |

---

### products / product_purchases
Digital downloadable products.

**products:**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| host_id | UUID FK | |
| title / description | TEXT | |
| price | NUMERIC | 0 = free |
| file_url / thumbnail_url | TEXT | Cloudinary URLs |
| is_active | BOOLEAN | |
| purchase_count | INTEGER | Incremented atomically |

**product_purchases:**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| product_id | UUID FK | |
| buyer_email / phone / name | TEXT | |
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
| host_id | UUID FK | |
| guest_name | TEXT | |
| rating | INTEGER | 1-5 |
| comment | TEXT | |

---

### subscription_plans
DB-driven plan configuration. 3 active plans enforced (min 2, max 3).

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | TEXT | `'starter'` \| `'creator'` \| `'professional'` |
| display_name | TEXT | Human label |
| annual_price | INTEGER | Paise |
| commission_percentage | NUMERIC | 0 or 5 |
| limits | JSONB | `{ services, products, bookings_per_year }` |
| features | JSONB | Feature flags array |
| is_active / is_archived | BOOLEAN | |
| sort_order | INTEGER | Display order |

---

### platform_settings
Key-value for platform-wide config.

| Key | Default | Notes |
|---|---|---|
| `platform_fee` | 10 | Flat fee per booking (₹) |
| `platform_fee_gst_rate` | 0.18 | GST on platform fee |
| `maintenance_mode` | false | 503s all public traffic when true |
| `platform_name` | Book A Sloth | |

---

### Badge System Tables

**badge_categories** — category groupings (e.g., "Excellence", "Engagement")
**badges** — badge definitions: name, image, description, rule_logic (AND/OR)
**badge_rules** — individual rules per badge: metric_key, operator, threshold
**vendor_badges** — awarded badges: vendor_id, badge_id, awarded_at, revoked_at, is_active
**vendor_metrics** (VIEW) — 14 aggregate metrics per vendor (bookings, rating, response time, etc.)

---

### Notification System Tables

**notification_providers** — provider config (AiSensy key, masked in admin UI)
**notification_events** — per-event channel toggles + campaign names
**notification_logs** — delivery log: event, channel, status, vendor_response

---

### Email System Tables

**email_settings** — provider choice (SMTP/Resend/SES), SMTP/API credentials, brand config
**email_templates** — DB-stored templates: event_key, audience, subject, body, variables list
**email_logs** — queue + delivery log: status (queued/sent/failed), attempts, provider_response

---

### Admin RBAC Tables

**admin_roles** — 6 roles with permission arrays: `superadmin`, `operations`, `finance`, `support`, `content`, `technical`
**admin_users** — staff accounts: username, email, bcrypt_password_hash, role_id, locked_until, last_login
**admin_audit_logs** — append-only: admin_id, action, target_type, target_id, details, ip, created_at

**RLS:** All three tables = deny_all (server-only via supabaseAdmin).

---

## Functions

| Function | Trigger / Call | Purpose |
|---|---|---|
| `handle_new_user()` | AFTER INSERT on `auth.users` | Auto-creates `profiles` row |
| `increment_product_purchase_count(uuid)` | Called from paymentController | Atomic purchase count increment |

---

## Schema Fallback Pattern

Any query touching a column added after v1.6 must include a fallback for pre-migration DBs:

```js
// SELECT fallback
let result = await supabaseAdmin.from('bookings').select('*, commission_applied');
if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
  result = await supabaseAdmin.from('bookings').select('id, status, vendor_amount, ...');
}

// INSERT fallback
const payload = { ...core, commission_applied: value };
let result = await supabaseAdmin.from('bookings').insert(payload).select().single();
if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
  const { commission_applied: _dropped, ...safePayload } = payload;
  result = await supabaseAdmin.from('bookings').insert(safePayload).select().single();
}
```

---

## Migration History

| Version | Key Changes | Status |
|---|---|---|
| `schema.sql` | Base tables: profiles, services, availability, bookings | Applied |
| `v1.1` | otp_codes table | Applied |
| `v1.2` | profiles.plan, plan_purchases | Applied |
| `v1.3` | services: grace_period, slug, thumbnail; otp_codes.type | Applied |
| `v1.4` | payout_requests | Applied |
| `v1.5` | increment_product_purchase_count | Applied |
| `v1.6` | Catchup: all profile columns | Applied |
| `v1.7` | bookings.commission_applied | ⚠️ Apply if missing |
| `v1.8` | Vendor onboarding state | Applied |
| `v1.9` | Notification system + hardened OTP | Applied |
| `v2.0` | Badge system + vendor_metrics view | Applied |
| `v2.1` | subscription_plans table + seed | Applied |
| `v2.2` | Full money model: GST, Razorpay fee, customer_total | Applied |
| `v2.3` | Email communication engine tables + 29 templates | Applied |
| `v2.4` | Admin RBAC: admin_roles, admin_users, admin_audit_logs | Applied |

---

## Related Documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) — how the server uses the DB
- [CODEBASE_GUIDE.md](CODEBASE_GUIDE.md) — which controllers own which tables
