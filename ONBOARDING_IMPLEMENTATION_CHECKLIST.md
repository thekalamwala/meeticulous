# Vendor Onboarding Implementation Checklist

## Pre-Launch Setup

### Database
- [ ] Run migration: `server/migrations/v1.8_vendor_onboarding.sql` in Supabase SQL Editor
  - Creates `otp_sessions` table
  - Creates `razorpay_orders` table
  - Adds 9 new columns to `profiles` table
- [ ] Verify RLS policies are in place for new tables (deny all for authenticated users)
- [ ] Test: `SELECT * FROM otp_sessions LIMIT 1` should work as service role, fail as authenticated user

### Environment Variables
- [ ] Ensure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set in `server/.env`
- [ ] (Optional) Set `AISENSY_API_URL`, `AISENSY_WEBHOOK_SECRET` to enable WhatsApp OTP
- [ ] (Optional) Set `NODE_ENV=development` to see OTP logs

### Server
- [ ] `cd server && npm install` (no new dependencies, uses existing packages)
- [ ] `npm run dev` — server should start on port 5000
- [ ] Check for any startup errors in console

### Client
- [ ] `cd client && npm install` (no new dependencies)
- [ ] `npm run dev` — client should start on port 5173
- [ ] No TypeScript or ESLint errors in console

---

## Step-by-Step Testing

### Step 0: Claim Username
**URL:** http://localhost:5173/vendor-register

**Test Cases:**
- [ ] Input "john" (too short) → shows "must be 3-60 chars"
- [ ] Input "JOHN" (uppercase) → converts to lowercase automatically
- [ ] Input "john-doe" (valid) → shows green checkmark after debounce
- [ ] Input "john-doe" again (taken) → shows red X
- [ ] Click "Claim & Continue" with valid slug → redirects to `/vendor-register/john-doe/verify`
- [ ] Verify `sessionStorage.onboarding_slug` is set
- [ ] Mobile: Button and input fully visible on 375px width

**Expected Output:**
✓ Session slug saved
✓ Navigation to step 1

---

### Step 1: OTP Verification
**URL:** http://localhost:5173/vendor-register/:slug/verify

**Test Cases:**
- [ ] Submit empty form → shows validation error
- [ ] Submit "Jane Doe", "jane@example.com", "+919876543210" → "OTPs sent" toast
- [ ] Check server logs: OTP should be logged (dev mode) or sent via email
- [ ] Enter wrong email OTP → "Invalid OTP"
- [ ] Enter correct email OTP → "Email verified" + green checkmark
- [ ] Phone OTP is optional → can skip to "Next: Set Password"
- [ ] (Optional) Enter correct phone OTP → "WhatsApp verified"
- [ ] After 3 failed attempts → "Too many attempts. Try again in 60 seconds."
- [ ] Click "Resend OTPs" → cooldown prevents immediate resend
- [ ] Mobile: Both OTP boxes side-by-side or stacked at narrow width

**Expected Output:**
✓ At least email OTP verified
✓ Navigation to step 2

---

### Step 2: Password (Account Creation Point)
**URL:** http://localhost:5173/vendor-register/:slug/password

**Test Cases:**
- [ ] Type password shorter than 8 chars → "must be at least 8 characters"
- [ ] Type password, confirm password mismatch → "Passwords do not match"
- [ ] Type strong password (8+ chars, mixed case, numbers, symbols) → strength meter shows "Strong"
- [ ] Type weak password → strength meter shows "Weak"
- [ ] Submit valid form → "Account created! Welcome!"
- [ ] Check Supabase:
  - [ ] New auth user created
  - [ ] New profile row created with `role='host'`, `onboarding_slug='slug'`, `onboarding_step_completed=2`
- [ ] Check localStorage: `user` object should have `token`, `refresh_token`, `id`
- [ ] Navigation to step 3

**Expected Output:**
✓ Auth user + profile row created
✓ Session token stored
✓ Navigation to step 3

---

### Step 3: Vendor Type
**URL:** http://localhost:5173/vendor-register/:slug/type

**Test Cases:**
- [ ] Two cards visible: Individual, Organisation
- [ ] Click "Individual" → card highlights, auto-saves, redirects to step 4
- [ ] Check database: `profiles.vendor_type='individual'`, `onboarding_step_completed=3`
- [ ] Go back to step 3 (via browser back) → selection is remembered
- [ ] Mobile: Cards stack vertically on narrow width

**Expected Output:**
✓ Vendor type saved
✓ Navigation to step 4

---

### Step 4: Categories
**URL:** http://localhost:5173/vendor-register/:slug/category

**Test Cases:**
- [ ] 11 category tiles visible (Coaching, Consulting, Tutoring, Wellness, Music, Photography, Design, Writing, Tech, Beauty, Other)
- [ ] Click "Coaching & Mentoring" → tile highlights with checkmark
- [ ] Click same tile again → highlight removed
- [ ] Click multiple categories (e.g., Coaching, Tech, Writing)
- [ ] Click "Save & Continue" with no selection → "Please select at least one category"
- [ ] Click "Save & Continue" with selection → toast "Categories saved", redirect to step 5
- [ ] Check database: `profiles.categories=['coaching','tech','writing']`
- [ ] Mobile: Tile grid responsive on narrow width

**Expected Output:**
✓ Categories saved as JSON array
✓ Navigation to step 5

---

### Step 5: Booking Type
**URL:** http://localhost:5173/vendor-register/:slug/booking-type

**Test Cases:**
- [ ] Three cards visible: Online Only, In-Person Only, Both
- [ ] Click "Online only" → card highlights, auto-saves, redirects to step 6
- [ ] Check database: `profiles.booking_type='online_only'`
- [ ] Test "In-person only" → database shows `booking_type='offline_only'`
- [ ] Test "Both" → database shows `booking_type='both'`
- [ ] Mobile: Cards stack on narrow width

**Expected Output:**
✓ Booking type saved
✓ Navigation to step 6

---

### Step 6: Calendar (Conditional Skip)
**URL:** http://localhost:5173/vendor-register/:slug/calendar

**Test Cases (Online/Both vendor):**
- [ ] "Connect Google Calendar" button visible
- [ ] "Skip for now" link visible
- [ ] Click "Connect Google Calendar" → redirects to Google OAuth
- [ ] (If you have Google credentials) Complete OAuth → redirected back to dashboard (TODO: fix redirect to step 7)
- [ ] Click "Skip for now" → "Skipped calendar step", redirect to step 7
- [ ] Check database: `profiles.calendar_skipped=true, calendar_connected=false`

**Test Cases (In-person only vendor):**
- [ ] Auto-skip to step 7 (redirect happens in frontend check)
- [ ] Database: `calendar_skipped=true` (auto-saved)

**Expected Output:**
✓ Calendar skipped or connected
✓ Navigation to step 7

---

### Step 7: Profile
**URL:** http://localhost:5173/vendor-register/:slug/profile

**Test Cases:**
- [ ] Camera icon visible for photo upload
- [ ] Click icon → file picker opens
- [ ] Select image > 5MB → "Image must be under 5MB"
- [ ] Select valid image → uploads to Cloudinary, shows in preview
- [ ] Type bio (e.g., "I'm a yoga coach with 10 years experience") → live character count updates
- [ ] Type > 160 chars → text truncates
- [ ] Click "Save & Continue" → database saved, redirect to step 8
- [ ] Click "Skip for now" → skips to step 8 without saving
- [ ] Check database: `profiles.profile_image=cloudinary_url`, `profiles.bio=text`
- [ ] Mobile: Photo upload responsive on narrow width

**Expected Output:**
✓ Profile photo and bio saved (or skipped)
✓ Navigation to step 8

---

### Step 8: First Service
**URL:** http://localhost:5173/vendor-register/:slug/first-service

**Test Cases:**
- [ ] All fields empty → "Save & Publish" button disabled
- [ ] Fill Title: "Career Coaching Session"
- [ ] Fill Description: "1-on-1 guidance for career transitions" (auto-truncates at 140 chars)
- [ ] Type: "Online" / "Offline"
- [ ] Duration: 60 (minutes)
- [ ] Price: 999 (₹)
- [ ] Click "Create Service & Continue" → toast "Service created!", redirect to step 9
- [ ] Check Supabase `services` table:
  - [ ] New service created with auto-slug (title-lowercase-hyphenated)
  - [ ] Fields match input values
  - [ ] `host_id` = current vendor ID
- [ ] Check database: `profiles.onboarding_step_completed=8`
- [ ] Mobile: Form responsive on narrow width

**Expected Output:**
✓ First service created
✓ Navigation to step 9

---

### Step 9: Plans
**URL:** http://localhost:5173/vendor-register/:slug/plans

**Test Cases (Free Plan):**
- [ ] Three plan cards visible (Explorer ₹0, Creator ₹999, Professional ₹3650)
- [ ] "Creator" card pre-selected (2px border, "Most Popular" badge)
- [ ] Click "Explorer" card → card highlights
- [ ] Click "Proceed with Explorer Plan" → instant activation (no Razorpay)
- [ ] Check database: `profiles.plan='explorer'`, `onboarding_completed=true`, `onboarding_step_completed=10`
- [ ] Redirect to step 10

**Test Cases (Paid Plan - Requires Test Razorpay Key):**
- [ ] Click "Creator" card (pre-selected)
- [ ] Click "Proceed with Creator Plan" → Razorpay checkout window opens
- [ ] (If using test card: 4111 1111 1111 1111, any future expiry, any CVV)
- [ ] Complete payment → checkout closes
- [ ] Frontend verifies payment via `/api/onboarding/verify-payment`
- [ ] Check database:
  - [ ] `razorpay_orders.payment_verified=true`, `status='completed'`
  - [ ] `profiles.plan='creator'`, `plan_expires_at=1 year from now`
  - [ ] `onboarding_completed=true`
- [ ] Redirect to step 10

**Test Cases (Payment Failure):**
- [ ] In Razorpay test, use declined card or cancel
- [ ] Checkout closes without success
- [ ] Remain on step 9 with error banner
- [ ] Retry payment available

**Expected Output:**
✓ Plan activated (free or verified paid)
✓ Navigation to step 10

---

### Step 10: Explore
**URL:** http://localhost:5173/vendor-register/:slug/explore

**Test Cases:**
- [ ] Welcome screen shows Sloth emoji + congratulations message
- [ ] "Book a demo with the BAS team" button visible (links to /demo-booking)
- [ ] "Go to my dashboard" button visible (links to /dashboard)
- [ ] Click either button → POST `/api/onboarding/mark-complete`
- [ ] Check database: `profiles.onboarding_completed=true`, `onboarding_step_completed=10`
- [ ] Redirect to /dashboard or /demo-booking
- [ ] Next login → ProtectedRoute checks status → allows dashboard access (no redirect)
- [ ] Mobile: Layout centered and readable on narrow width

**Expected Output:**
✓ Onboarding marked complete
✓ Dashboard access enabled

---

## Resume Logic Testing

**Setup:** Create vendor account, save at step 5 (Booking Type)

**Test Cases:**
- [ ] Close browser, reopen http://localhost:5173
- [ ] Not logged in → redirect to /login
- [ ] Log in with vendor credentials
- [ ] Should immediately redirect to `/vendor-register/:slug/booking-type` (step 5, next incomplete)
- [ ] Manually navigate to /dashboard → ProtectedRoute redirects to step 5
- [ ] Complete step 5 → can now access dashboard
- [ ] Log out, log in again → dashboard accessible (no redirect)

**Expected Output:**
✓ Incomplete vendors resume from last step
✓ Complete vendors access dashboard directly

---

## Edge Cases & Security

### OTP Attempts & Lockout
- [ ] Enter wrong OTP 3 times → "Too many attempts. Try again in 60 seconds."
- [ ] Wait 60 seconds → "Resend OTPs" button enabled
- [ ] Resend → new OTP generated, sent via email
- [ ] Check database: `email_locked_until` timestamp set

### Slug Collision
- [ ] Create vendor 1 with slug "john-doe"
- [ ] Attempt to create vendor 2 with slug "john-doe"
- [ ] Step 1 shows red X: "Slug already taken"
- [ ] Cannot proceed (button disabled)

### Payment Verification
- [ ] Create Razorpay order (stored in DB with status='pending')
- [ ] Attempt to verify with:
  - [ ] Wrong order ID → verification fails
  - [ ] Non-captured payment → verification fails
  - [ ] Correct payment → verification succeeds, plan activated
- [ ] Check database: `razorpay_orders.payment_verified` only true for successful verification

### Session Isolation
- [ ] Log in as vendor 1 (slug "john")
- [ ] Manually navigate to `/vendor-register/jane/password` (different slug)
- [ ] Should reject or handle gracefully (prevent cross-vendor attacks)

---

## Performance & Mobile

### Slug Availability Check
- [ ] Debounce working (checks after 400ms of no typing)
- [ ] No excessive API calls in network tab (should be 1 per user input after debounce)

### Mobile Responsiveness (375px width)
- [ ] Step 0: Input + button full width, readable
- [ ] Step 1: Name/email/phone inputs stack vertically, buttons full width
- [ ] Step 2: Password input + strength meter visible
- [ ] Step 3: Vendor type cards stack, clickable
- [ ] Step 4: Category tiles wrap to 2 columns
- [ ] Step 5: Booking type cards stack
- [ ] Step 6: Calendar button full width
- [ ] Step 7: Photo preview visible, bio textarea full width
- [ ] Step 8: Form inputs stack, submit button full width
- [ ] Step 9: Plan cards stack vertically, "Proceed" button full width
- [ ] Step 10: Message + buttons centered, readable
- [ ] No horizontal scrolling on any step

### Console
- [ ] No JavaScript errors in browser console
- [ ] No TypeScript errors (if using Vite with TypeScript)
- [ ] No ESLint warnings (if using frontend linting)
- [ ] Network tab shows 200 responses for all API calls

---

## Integration Tests (Future)

Run these after manual testing passes:

```bash
# Server tests
cd server
npm test -- vendorOnboarding.test.js

# Client tests (if set up)
cd ../client
npm test -- onboarding.test.jsx
```

---

## Rollout Checklist

### Pre-Launch
- [ ] Database migration applied
- [ ] Environment variables set
- [ ] All manual tests passed
- [ ] Console clean (no errors)
- [ ] Mobile layout verified
- [ ] Resume logic tested
- [ ] Payment flow tested (free + paid)
- [ ] Docs reviewed (`docs/vendor-onboarding.md`)

### Launch
- [ ] Deploy server changes
- [ ] Deploy client changes
- [ ] Monitor onboarding completion rate
- [ ] Monitor error logs for 401/403 issues
- [ ] Monitor Razorpay webhook success rate
- [ ] Test email OTP delivery

### Post-Launch
- [ ] Track step drop-off rates
- [ ] Collect user feedback on UX friction points
- [ ] Monitor API latency
- [ ] Plan next iteration (webhook auto-verify, etc.)

---

## Common Issues & Fixes

### Issue: "Slug not found after account creation"
**Cause:** sessionStorage slug doesn't match DB slug
**Fix:** Ensure slug is saved at step 0, passed through all routes, and persisted at step 2

### Issue: "Account creation succeeds without OTP verification"
**Cause:** `createVendorAccount` not checking OTP session
**Fix:** Verify `otp_sessions.email_verified=true OR phone_verified=true` before creating auth user

### Issue: "Plan activation without payment verification"
**Cause:** Frontend redirect trusted instead of server-side verification
**Fix:** Ensure `/api/onboarding/verify-payment` checks Razorpay API before updating `profiles.plan`

### Issue: "Mobile inputs too small on 375px"
**Cause:** CSS not responsive
**Fix:** Check `fb-input` class uses `w-full` and sufficient padding; test on actual iPhone/Android

### Issue: "OTP resend not working after lockout"
**Cause:** Lockout timestamp not cleared after resend
**Fix:** Ensure resend endpoint clears `email_locked_until` and resets attempt count

---

## Success Criteria

✅ All 10 steps render correctly
✅ All steps save data immediately
✅ OTP verification works (email required, phone optional)
✅ Account created only after OTP verification
✅ Resume logic redirects incomplete vendors
✅ Payment verified server-side before plan activation
✅ Free plan activates without Razorpay
✅ Paid plans verified via Razorpay API
✅ Mobile layout responsive at 375px
✅ No console errors
✅ All API calls return 200/201 status
✅ Database migrations applied
✅ Documentation complete and accurate

---

## Timeline Estimate

**Testing:** 2-3 hours (manual walkthrough)
**Debugging:** 1-2 hours (edge cases, mobile, payment)
**Documentation & Cleanup:** 1 hour
**Total:** 4-6 hours to full launch

---

**Ready to test! 🚀**

Start at http://localhost:5173/vendor-register and complete all 10 steps.
