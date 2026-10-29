# Deployment — Meeticulous

## Architecture Overview

The application has two separately deployable parts:
- **Client** — static React SPA built by Vite → deploy to any CDN/static host
- **Server** — Node.js/Express API → deploy to any Node.js host

---

## Building for Production

### Client Build

```bash
cd client
npm run build
```

Output: `client/dist/` — a static folder with `index.html` + hashed JS/CSS chunks.

Key Vite settings (`client/vite.config.js`):
- Code splitting enabled (each route is a separate chunk)
- All public dependencies chunked separately (react, axios, supabase, razorpay)

### Server

No build step required — Node.js runs `server.js` directly.

```bash
# Production start
cd server
NODE_ENV=production npm start
```

---

## Deployment Options

### Option A: Separate Hosts (Recommended)

**Client:** Vercel, Netlify, Cloudflare Pages, AWS S3+CloudFront
- Upload `client/dist/` contents
- Set environment variables: `VITE_API_URL`, `VITE_RAZORPAY_KEY_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Configure SPA routing: redirect all 404s to `index.html`

**Server:** Railway, Render, Fly.io, DigitalOcean App Platform, AWS EC2/ECS
- Deploy `server/` directory
- Set all `server/.env` variables as environment variables
- Expose port 5000 (or set `PORT` to whatever the host assigns)

### Option B: Single Server

Serve the static client from Express:

```js
// Add to server.js after routes:
const path = require('path');
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});
```

Then deploy the entire repo to a single Node.js host.

---

## Environment Variables Checklist

### Server — All Required for Production

```env
NODE_ENV=production
PORT=5000                        # or as assigned by host
CLIENT_URL=https://yourdomain.com  # exact origin for CORS

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...    # keep secret

SMTP_HOST=...
SMTP_PORT=465
SMTP_USER=...
SMTP_PASS=...

RAZORPAY_KEY_ID=rzp_live_...    # live key in production
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

SUPER_ADMIN_JWT_SECRET=...       # REQUIRED — server throws on startup if missing in production
SUPER_ADMIN_EMAIL=...

GOOGLE_CLIENT_ID=...             # if Google Calendar enabled
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://yourapi.com/api/auth/google/callback

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### Client — Set at Build Time

```env
VITE_API_URL=https://yourapi.com
VITE_RAZORPAY_KEY_ID=rzp_live_...
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

**Important:** Vite bakes `VITE_*` variables into the build at compile time. You must rebuild the client if these change.

---

## Supabase Production Setup

1. **Upgrade to Pro** if expecting >500MB database or >500K auth users
2. Apply all migrations (see [DATABASE.md](DATABASE.md)) to the production project
3. Seed email templates: `node scripts/seedEmailTemplates.js` (with production env)
4. Enable **email confirmations** in Supabase Auth settings if desired
5. Set `CLIENT_URL` in Supabase Auth → URL Configuration → Site URL
6. Add `CLIENT_URL` to Supabase Auth → URL Configuration → Redirect URLs

---

## Razorpay Production Setup

1. Complete KYC and get live keys
2. Set `rzp_live_*` keys in environment variables
3. Register webhook URL: `https://yourapi.com/api/payment/webhook`
4. Subscribe to events: `payment.captured`, `payment.failed`
5. Copy the webhook signing secret to `RAZORPAY_WEBHOOK_SECRET`

---

## Cloudinary Setup

1. Create account at cloudinary.com
2. Copy Cloud Name, API Key, API Secret to environment variables
3. Create an upload preset or use signed uploads (current implementation uses signed)

---

## Production Checklist

Before going live:

- [ ] All database migrations applied
- [ ] Email templates seeded
- [ ] `SUPER_ADMIN_JWT_SECRET` set (strong random value)
- [ ] Admin passwords changed from defaults (see initial admin credentials delivered in chat)
- [ ] Razorpay live keys in place
- [ ] Razorpay webhook URL registered and `RAZORPAY_WEBHOOK_SECRET` set
- [ ] CORS: `CLIENT_URL` set to exact production domain (no trailing slash)
- [ ] Supabase: production project URL + service role key
- [ ] Email: working SMTP or Resend/SES credentials in `email_settings` table
- [ ] Test a full booking flow end-to-end
- [ ] Test admin login at `/hello-sloth`
- [ ] Maintenance mode OFF in platform settings

---

## Health Check

The API exposes a basic health endpoint:

```
GET /
→ { "message": "Meeticulous API v1.4 running" }
```

Use this for uptime monitoring.

---

## Cron Jobs in Production

The server runs 4 `setInterval` cron jobs inside `server.js`. In a single-instance deployment, these run automatically. For multi-instance deployments:

- You likely want only one instance running the cron jobs to avoid duplicate emails
- Consider extracting cron jobs to a separate worker process or Supabase Edge Function scheduled tasks
- Current crons: reminders (5min), OTP cleanup (60min), email queue (60min), badge eval (60min)

---

## Scaling Notes

- The server is stateless except for the cron jobs
- OTPs are DB-backed (not in-memory) so multiple server instances work correctly
- Email queue is DB-backed — multiple instances will race to pick up queued emails; safe due to row-level updates, but may cause duplicate sends in edge cases
- Consider a dedicated queue worker for email at scale

---

## Related Documentation
- [SECURITY.md](SECURITY.md) — production security hardening
- [DEVELOPMENT.md](DEVELOPMENT.md) — local environment setup
