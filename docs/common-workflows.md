# Common Workflows — Book A Sloth

## How to Add a New API Endpoint

1. Add controller function in `server/controllers/<feature>Controller.js`
2. Add route in `server/routes/<feature>Routes.js`
3. Add client call in `client/src/services/api.js`
4. Update `docs/feature-map.md` if it's a new feature

**Route registration pattern:**
```js
// routes/exampleRoutes.js
router.get('/items',     protect, getItems);          // authenticated
router.get('/items/:id', getItemById);                 // public
router.post('/items',    protect, attachPlan, checkServiceLimit, createItem); // with plan check
```

---

## How to Add a New DB Column

1. Write migration SQL using `ADD COLUMN IF NOT EXISTS`
2. Save as `server/migrations/vX.Y_description.sql`
3. Run in Supabase SQL Editor
4. If column may not exist on some DBs, add schema fallback in the controller
5. Update `docs/database-schema.md` with the new column

**Migration template:**
```sql
-- vX.Y_description.sql
ALTER TABLE table_name
  ADD COLUMN IF NOT EXISTS new_column TEXT DEFAULT '';

COMMENT ON COLUMN table_name.new_column IS 'Purpose and semantics.';
```

---

## How to Add a New Booking Step

1. Add the step string to the `STEPS` array logic in `ServiceBooking.jsx`
2. Add the step label to `LABELS` object
3. Add the JSX block `{step === 'newstep' && ( ... )}` following the existing card pattern:
   ```jsx
   <div className="bg-white border rounded-2xl p-5 sm:p-7">
     <div className="max-w-md mx-auto text-center">
       {/* icon, heading, content */}
     </div>
   </div>
   ```
4. Add transition in the preceding step's CTA button (`onClick={() => setStep('newstep')}`)

---

## How to Add a New Dashboard Page

1. Create `client/src/pages/NewPage.jsx`
2. Add route to `App.jsx`:
   ```jsx
   <Route path="/dashboard/new-page" element={<DashboardWrapper><NewPage /></DashboardWrapper>} />
   ```
3. Add nav item in `DashboardLayout.jsx`
4. Add API calls to `api.js` if needed

---

## How to Add a Plan-Gated Feature

1. Add limit to `PLAN_LIMITS` in `server/middleware/planMiddleware.js`
2. Create a new middleware function (or extend `checkServiceLimit` pattern)
3. Apply to the route: `router.post('/feature', protect, attachPlan, checkFeatureLimit, handler)`
4. Frontend: check `user.plan` to show upgrade prompt if needed
5. Update `docs/feature-map.md` → Plan Management section

---

## How to Send Emails

Use `sendEmail` from `utils/sendEmail.js`. Always wrap in try/catch:
```js
const sendEmail = require('../utils/sendEmail');

try {
  await sendEmail({
    to: recipientEmail,
    subject: 'Subject line',
    html: emailHtml(`
      <p>Content here</p>
      ${row("Label", "Value")}
      ${button("https://...", "CTA Text")}
    `),
  });
} catch (emailError) {
  console.error('Email error:', emailError.message);
}
```

`emailHtml()`, `row()`, and `button()` helpers are defined at top of `bookingController.js`. Copy them if needed in other controllers.

---

## How to Handle OTP in a New Context

The `otpStore` is designed for the booking OTP flow. For a new OTP use case:
1. Use `otpStore.set(email, otp)` to store — it upserts to `otp_codes` table
2. Use `otpStore.verify(email, otp)` to check — returns `{ valid: true }` or `{ valid: false, reason: '...' }`
3. Be aware `otp_codes.email` is a PRIMARY KEY — one active OTP per email at a time
4. If you need type-specific OTPs: filter by `type` column (default `'booking'`)

---

## How to Add a New Service Field

1. Add column to `services` table migration
2. Update `serviceController.js` `buildPayload()` to include new field
3. Update `ServiceForm.jsx` to add the form input
4. Run `svcGetAll` / `svcGetById` — they use `SELECT *` so new columns auto-appear

---

## How to Debug a Booking Failure

1. Check `server/controllers/bookingController.js` `createBooking`
2. Common causes:
   - **Schema error:** column not found → check migration status, ensure fallback covers it
   - **409 conflict:** double-booking → check grace period logic
   - **403:** plan limit hit → check `checkBookingReceiveLimit`
   - **400 past time:** `newStart <= new Date()` — timezone mismatch? Check `wallClockToUTC` in `ServiceBooking.jsx`
   - **Payment not confirming:** check `paymentController.verifyPayment` HMAC check

---

## How to Fix a Supabase Schema Cache Error

The error pattern: `"Could not find the 'column_name' column of 'table' in the schema cache"`

**Quick fix (code):** add schema fallback using the existing pattern in `bookingController.js`

**Proper fix (DB):** run the pending migration (`v1.7_pricing_snapshot.sql`) in Supabase SQL Editor → Dashboard → SQL Editor → New Query

**Force schema refresh:** In Supabase dashboard, go to Settings → API → click "Reload" on the schema cache, or restart the API.

---

## How to Add a New Host Profile Field

1. Add column to `profiles` table via migration
2. Add to `authController.js` `buildUserPayload()` return object (so `getMe` returns it)
3. Add to `hostController.js` `updateProfile` allowed fields
4. Add to `ProfileSetup.jsx` form
5. Update `AuthContext.jsx` if the field affects auth state
6. Update `docs/database-schema.md`

---

## How to Create a New Razorpay Payment

Follow `paymentController.js` pattern:
```js
// 1. Create order
const order = await razorpay.orders.create({
  amount: amountInPaise,
  currency: 'INR',
  receipt: `receipt_${Date.now()}`,
});

// 2. Return order to client
res.json({ razorpay_order_id: order.id, amount: order.amount, currency: order.currency });

// 3. Client opens Razorpay checkout (see ServiceBooking.jsx handlePayment)

// 4. Verify webhook/callback
const body = razorpay_order_id + "|" + razorpay_payment_id;
const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  .update(body).digest('hex');
if (expectedSignature !== razorpay_signature) return res.status(400).json({ message: 'Invalid signature' });
```
