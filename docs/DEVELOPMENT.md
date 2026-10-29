# Development Guide — Book A Sloth

## Prerequisites

- **Node.js** ≥ 18 (`node --version`)
- **npm** ≥ 9
- **Supabase account** — free tier works for dev
- **Razorpay test account** — test keys available without KYC
- **SMTP access** — Gmail with App Password works
- **Cloudinary account** — free tier for image uploads

---

## Initial Setup

### 1. Install Dependencies

```bash
# From repo root
cd server && npm install
cd ../client && npm install
```

### 2. Configure Server Environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
# Server
PORT=5000
CLIENT_URL=http://localhost:5173
API_URL=http://localhost:5000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJh...          # anon / public key
SUPABASE_SERVICE_ROLE_KEY=eyJh...  # service role key (secret — server only)

# Email — SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx      # Gmail App Password

# Razorpay (use test keys for development)
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...        # from Razorpay dashboard

# Admin
SUPER_ADMIN_JWT_SECRET=some-long-random-secret
SUPER_ADMIN_EMAIL=your@email.com

# Optional: Google Calendar
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

# Optional: Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### 3. Configure Client Environment

Create `client/.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_RAZORPAY_KEY_ID=rzp_test_...
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...
```

### 4. Set Up Database

In your Supabase dashboard → SQL Editor, run these files in order:

```
server/config/schema.sql
server/migrations/v1.6_catchup.sql
server/migrations/v1.7_pricing_snapshot.sql
server/migrations/v1.8_vendor_onboarding.sql
server/migrations/v1.9_notification_system.sql
server/migrations/v2.0_badge_system.sql
server/migrations/v2.1_subscription_plans.sql
server/migrations/v2.2_payout_model.sql
server/migrations/v2.3_email_communication_engine.sql
server/migrations/v2.4_admin_rbac.sql
```

### 5. Seed Email Templates

```bash
cd server && node scripts/seedEmailTemplates.js
```

This inserts 29 email templates into the `email_templates` table.

### 6. Run Development Servers

```bash
# Terminal 1 — API (port 5000, auto-restarts on change)
cd server && npm run dev

# Terminal 2 — React dev server (port 5173, HMR)
cd client && npm run dev
```

Open **http://localhost:5173**.

---

## Common Development Workflows

### Creating a New API Endpoint

1. Add handler to the appropriate controller in `server/controllers/`
2. Add route to `server/routes/<domain>Routes.js` with correct middleware
3. Export a named function from `client/src/services/api.js`
4. Call the function from the page component

Example:
```js
// server/controllers/serviceController.js
const myNewAction = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('services').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// server/routes/serviceRoutes.js
router.get('/my-action', protect, myNewAction);

// client/src/services/api.js
export const myNewAction = () => api.get('/services/my-action');
```

### Adding a DB Column

1. Write a migration SQL file in `server/migrations/`
2. Apply it in Supabase SQL Editor
3. Add schema fallback pattern to any controller that queries or inserts the column (see [CODEBASE_GUIDE.md](CODEBASE_GUIDE.md))
4. Update [DATABASE.md](DATABASE.md)

### Adding an Email Template

1. Add definition to `server/config/emailTemplates.js`
2. Run `node scripts/seedEmailTemplates.js`
3. Register the event key in `notification_events` table (or via admin UI)
4. Call `communicationEngine.send({ event: 'EVENT_KEY', audience: 'customer', data: {...} })`

### Adding a New Plan Limit

Plan limits are fully DB-driven in the `subscription_plans` table. No code changes needed — edit via admin UI at `/admin/plans`.

### Changing the Platform Fee

Platform fee is DB-driven in `platform_settings`. Edit via admin UI at `/admin/settings`. Changes apply within 60 seconds (config cache TTL).

---

## Environment Variables Reference

### Server (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Express port (default 5000) |
| `CLIENT_URL` | Yes | CORS allowlist — React dev URL |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role (server-only, secret) |
| `SMTP_HOST` | Yes | SMTP server hostname |
| `SMTP_PORT` | Yes | SMTP port (465 for SSL, 587 for STARTTLS) |
| `SMTP_USER` | Yes | SMTP username |
| `SMTP_PASS` | Yes | SMTP password / app password |
| `RAZORPAY_KEY_ID` | Yes | Razorpay key ID |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay key secret |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Razorpay webhook signing secret |
| `SUPER_ADMIN_JWT_SECRET` | Yes | Admin JWT signing secret (fail-closed in production) |
| `SUPER_ADMIN_EMAIL` | Yes | Initial super admin email |
| `GOOGLE_CLIENT_ID` | Optional | For Google Calendar integration |
| `GOOGLE_CLIENT_SECRET` | Optional | For Google Calendar integration |
| `GOOGLE_REDIRECT_URI` | Optional | Google OAuth callback URL |
| `CLOUDINARY_CLOUD_NAME` | Optional | For image uploads |
| `CLOUDINARY_API_KEY` | Optional | For image uploads |
| `CLOUDINARY_API_SECRET` | Optional | For image uploads |
| `BADGE_EVAL_INTERVAL_MIN` | Optional | Badge cron interval in minutes (default 60) |
| `NODE_ENV` | Optional | `'production'` to enforce SUPER_ADMIN_JWT_SECRET check |

### Client (`client/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | API base URL (`http://localhost:5000`) |
| `VITE_RAZORPAY_KEY_ID` | Yes | Razorpay public key (displayed in checkout widget) |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key |

---

## Useful Dev Commands

```bash
# Run all server tests
cd server && npm test

# Run only unit tests
cd server && npm run test:unit

# Run with coverage
cd server && npm run test:coverage

# Watch mode
cd server && npm run test:watch

# Run client tests
cd client && npm test

# Build client for production
cd client && npm run build

# Preview production build
cd client && npm run preview
```

---

## Debugging Tips

### "No OTP found" errors
- OTP is DB-backed. Check the `otp_codes` table in Supabase.
- Verify email is normalized (lowercase, trimmed).
- OTPs expire after 10 minutes; 3 verify attempts; 3 sends/hour.

### "Column does not exist" errors
- A migration hasn't been applied. Check `server/migrations/` and apply the missing one.
- The schema fallback in the controller handles this gracefully, but the snapshot won't be stored.

### "Revenue is always ₹0" in admin stats
- Ensure `platform_fee_amount` and `commission_applied` columns exist (v1.7 migration).
- `getStats` queries these columns specifically.

### Booking emails not sending
- Check `email_settings` table in Supabase — provider must be configured.
- Check `email_logs` table for queued/failed messages.
- The email queue worker runs every 60 seconds.
- For immediate sends (OTP), check SMTP credentials.

### Admin login fails
- Admin users are in `admin_users` table, not `auth.users`.
- After 5 failed attempts, account locks for 15 minutes.
- Check `admin_users.locked_until` in Supabase if locked.

### Razorpay checkout not loading
- Verify `VITE_RAZORPAY_KEY_ID` in `client/.env` uses the correct mode (test/live).
- Check browser console for Razorpay SDK errors.

---

## Code Editor Setup

Recommended VS Code extensions:
- **ES7+ React/Redux/React-Native snippets**
- **Tailwind CSS IntelliSense**
- **ESLint**
- **Prettier**

No `.eslintrc` or `.prettierrc` currently in the repo — add if desired.

---

## Related Documentation
- [CONTRIBUTING.md](CONTRIBUTING.md) — coding conventions and PR process
- [TESTING.md](TESTING.md) — how to write and run tests
- [DEPLOYMENT.md](DEPLOYMENT.md) — production build and deployment
