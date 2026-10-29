# API Reference — Book A Sloth

Base URL: `http://localhost:5000/api` (dev) or your production domain.

All protected endpoints require `Authorization: Bearer <token>` header.
Admin endpoints require the admin JWT (`localStorage['bas_admin']`).

**Response format:**
- Success: `200/201` with JSON body
- Error: `4xx/5xx` with `{ message: "..." }`
- Plan errors: `403` with `{ message: "...", upgrade_required: true, current_plan: "..." }`

---

## Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register/vendor` | — | Register vendor. Body: `{ email, password, name }` |
| POST | `/register/user` | — | Register guest. Body: `{ email, password, name }` |
| POST | `/login` | — | Login. Body: `{ email, password }` → `{ token, refresh_token, user }` |
| GET | `/me` | ✓ | Get current user profile |
| POST | `/send-otp` | — | Send OTP. Body: `{ email, type }` (`'booking'` or `'password_reset'`) |
| POST | `/verify-otp` | — | Verify OTP. Body: `{ email, otp }` → `{ success: true }` |
| POST | `/forgot-password` | — | Send password reset OTP. Body: `{ email }` |
| POST | `/reset-password` | — | Reset password. Body: `{ email, otp, newPassword }` |
| GET | `/google` | ✓ | Initiate Google OAuth (calendar) |
| GET | `/google/callback` | — | Google OAuth callback |
| POST | `/logout` | ✓ | Logout (clears Supabase session) |

---

## Admin Auth — `/api/admin-auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/login` | — | Admin login. Body: `{ username, password }` → `{ token, admin }` |
| POST | `/logout` | Admin | Logout |
| GET | `/me` | Admin | Get current admin user + permissions |

---

## Vendor Onboarding — `/api/onboarding`

10-step flow. Each step validates the previous step's completion.

| Method | Path | Description |
|---|---|---|
| POST | `/start` | Claim slug, send OTP. Body: `{ username, email }` |
| POST | `/:slug/verify-otp` | Verify OTP |
| POST | `/:slug/set-password` | Set account password |
| POST | `/:slug/vendor-type` | Set vendor category/type |
| POST | `/:slug/category` | Set service category |
| POST | `/:slug/booking-type` | Set booking type preferences |
| POST | `/:slug/calendar` | Connect Google Calendar |
| POST | `/:slug/profile` | Set profile info |
| POST | `/:slug/first-service` | Create first service |
| POST | `/:slug/plans` | Select plan |
| GET | `/:slug/status` | Get onboarding progress |

---

## Host — `/api/host`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/:username` | — | Get public host profile |
| GET | `/:username/:serviceSlug` | — | Get service + host for booking |
| GET | `/availability` | ✓ | Get own availability |
| PUT | `/availability` | ✓ | Update availability. Body: `{ weekly_schedule, blocked_dates, timezone, buffer_minutes }` |
| GET | `/earnings` | ✓ | Earnings summary (confirmed bookings total) |
| PUT | `/profile` | ✓ | Update own profile |

---

## Bookings — `/api/bookings`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | — | Create booking. Body: `{ service_id, host_id, scheduled_at, guest_name, guest_email, guest_phone, notes }` |
| GET | `/host` | ✓ | Get all bookings as host (with filters: status, date) |
| GET | `/slots` | — | Get booked time slots. Query: `?host_id=&date=YYYY-MM-DD` |
| PUT | `/:id/status` | ✓ | Update booking status. Body: `{ status }` |
| PUT | `/:id/reschedule` | ✓ | Reschedule. Body: `{ scheduled_at }` → sends guest acknowledgement email |
| GET | `/:id/confirm-reschedule` | — | Guest acknowledges reschedule via token. Query: `?token=` |
| DELETE | `/:id` | ✓ | Cancel booking |

---

## Payment — `/api/payment`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/create-order` | — | Create Razorpay order. Body: `{ booking_id }` → `{ order_id, amount, currency }` |
| POST | `/verify` | — | Verify payment. Body: `{ razorpay_payment_id, razorpay_order_id, razorpay_signature, booking_id }` |
| POST | `/webhook` | — | Razorpay webhook (raw body, HMAC verified) |
| POST | `/subscribe-plan` | ✓ | Create plan subscription order. Body: `{ plan }` |
| POST | `/verify-subscription` | ✓ | Verify plan payment. Body: `{ razorpay_payment_id, plan }` |
| POST | `/purchase-product` | — | Create product order. Body: `{ product_id, buyer_email, buyer_name, buyer_phone }` |
| POST | `/verify-product` | — | Verify product payment. Body: `{ razorpay_payment_id, product_id, buyer_email }` |

---

## Services — `/api/services`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | ✓ | Get own services |
| POST | `/` | ✓ Plan | Create service (plan limit enforced) |
| GET | `/:id` | ✓ | Get single service |
| PUT | `/:id` | ✓ | Update service |
| DELETE | `/:id` | ✓ | Delete service |
| PUT | `/:id/toggle` | ✓ | Toggle is_active |
| POST | `/:id/duplicate` | ✓ Plan | Duplicate service (plan limit enforced) |
| GET | `/public/:profileSlug/:serviceSlug` | — | Get public service by slugs |

---

## Vendor — `/api/vendor`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/profile` | ✓ | Get vendor profile |
| PUT | `/profile` | ✓ | Update vendor profile |
| GET | `/payouts` | ✓ | Get payout requests |
| POST | `/payouts` | ✓ | Create payout request |
| GET | `/transactions` | ✓ | Get transaction history |

---

## Reviews — `/api/reviews`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | — | Submit review. Body: `{ booking_id, rating, comment, guest_name }` |
| GET | `/:username` | — | Get reviews for a host |
| GET | `/booking/:bookingId` | — | Get review for a booking |

---

## Products — `/api/products`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | ✓ | Get own products |
| POST | `/` | ✓ Plan | Create product (plan limit enforced) |
| PUT | `/:id` | ✓ | Update product |
| DELETE | `/:id` | ✓ | Delete product |
| GET | `/download/:token` | — | Download file via time-limited token |

---

## Uploads — `/api/upload`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/image` | ✓ | Upload image to Cloudinary (multipart). Returns `{ url }` |

---

## Public Vendor Badges — `/api/vendors`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/:username/badges` | — | Get all badges for a host |
| GET | `/:username/badges/:badgeId` | — | Get single badge detail |

---

## Plans — `/api/plans`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | — | Get all active plans (public pricing page) |

---

## Admin — `/api/admin`

All admin endpoints require `Authorization: Bearer <admin_jwt>`.
Permission requirements listed in brackets.

### Stats & Operations

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/stats` | `view_dashboard` | Platform stats: users, bookings, revenue |
| GET | `/ops/summary` | `view_operations` | Real attention queue for ops center |

### Users

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/users` | `view_users` | List users (paginated, filterable) |
| GET | `/users/:id` | `view_users` | User detail with booking/service counts |
| PUT | `/users/:id` | `edit_users` | Update user (role, verified, banned, etc.) |
| DELETE | `/users/:id` | `delete_users` | Delete user (cascade) |

### Bookings

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/bookings` | `view_bookings` | List bookings (paginated) |
| PUT | `/bookings/:id` | `edit_bookings` | Update status / payment_status |
| DELETE | `/bookings/:id` | `delete_bookings` | Delete booking |

### Services

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/services` | `view_services` | List all services |
| DELETE | `/services/:id` | `delete_services` | Delete service |

### Plans

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/plans` | `view_plans` | List all plans |
| POST | `/plans` | `edit_plans` | Create plan |
| PUT | `/plans/:id` | `edit_plans` | Update plan |
| DELETE | `/plans/:id` | `edit_plans` | Archive plan |
| POST | `/plans/:id/clone` | `edit_plans` | Clone plan |
| POST | `/plans/:id/reorder` | `edit_plans` | Reorder plans |
| POST | `/plans/assign` | `edit_plans` | Assign plan to vendor |

### Badges

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/badges` | `view_badges` | List badges |
| POST | `/badges` | `edit_badges` | Create badge |
| PUT | `/badges/:id` | `edit_badges` | Update badge |
| POST | `/badges/:id/evaluate` | `edit_badges` | Run badge evaluation |
| POST | `/badges/vendors/:vendorId/assign` | `edit_badges` | Manually assign badge |
| POST | `/badges/vendors/:vendorId/revoke` | `edit_badges` | Revoke badge |

### Email

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/email/templates` | `view_email` | List templates |
| POST | `/email/templates` | `edit_email` | Create template |
| PUT | `/email/templates/:id` | `edit_email` | Update template |
| POST | `/email/templates/:id/duplicate` | `edit_email` | Duplicate template |
| POST | `/email/templates/:id/preview` | `view_email` | Render preview |
| POST | `/email/templates/:id/test` | `edit_email` | Send test email |
| GET | `/email/logs` | `view_email` | Email delivery logs |
| POST | `/email/logs/:id/retry` | `edit_email` | Retry failed email |
| GET | `/email/settings` | `view_email` | Email provider settings |
| PUT | `/email/settings` | `edit_email` | Update provider settings |
| GET | `/email/events` | `view_email` | Notification event registry |

### Notifications

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/notifications/providers` | `view_notifications` | List providers |
| PUT | `/notifications/providers/:id` | `edit_notifications` | Update provider |
| POST | `/notifications/providers/:id/test` | `edit_notifications` | Test connection |
| GET | `/notifications/events` | `view_notifications` | List events |
| PUT | `/notifications/events/:id` | `edit_notifications` | Update event toggles |
| POST | `/notifications/test-send` | `edit_notifications` | Send test notification |
| GET | `/notifications/logs` | `view_notifications` | Delivery logs |
| POST | `/notifications/logs/:id/retry` | `edit_notifications` | Retry notification |

### Staff

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/staff` | `manage_staff` | List staff |
| POST | `/staff` | `manage_staff` | Create staff account |
| PUT | `/staff/:id` | `manage_staff` | Update staff (role, password reset) |
| POST | `/staff/:id/activate` | `manage_staff` | Activate/deactivate staff |

### Audit

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/audit` | `view_audit` | Audit log (paginated, filterable) |

### Settings

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/settings` | `view_settings` | Get platform settings |
| PUT | `/settings` | `edit_settings` | Update platform settings |

---

## Error Codes

| HTTP | When |
|---|---|
| 400 | Invalid input / validation failure |
| 401 | Missing or invalid auth token |
| 403 | Valid auth but insufficient permissions or plan |
| 404 | Resource not found |
| 409 | Conflict (e.g., time slot already booked) |
| 429 | Rate limit exceeded |
| 503 | Maintenance mode active |
| 500 | Unexpected server error |

---

## Related Documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) — auth flows and how tokens work
- [SECURITY.md](SECURITY.md) — rate limits and security headers
