# Book A Sloth — Comprehensive Bug Report
**Date:** June 5, 2026  
**Scope:** Full source audit — User, Vendor (Host), and Admin perspectives  
**Severity levels:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## CRITICAL BUGS 🔴

---

### BUG-01 · `cancelBooking` and `completeBooking` have no ownership check
**Affects:** Vendor, User  
**File:** `server/controllers/bookingController.js` — `cancelBooking` (line 345), `completeBooking` (line 361)

**Problem:**  
Both endpoints are behind `protect` (requires any valid JWT) but do not verify that `req.user.id` belongs to the booking's `host_id` or `guest_id`. Any logged-in user who discovers a booking UUID can cancel or complete it.

```js
// CURRENT — no ownership check
const cancelBooking = async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", req.params.id)  // ← no host/guest check
    ...
```

**Fix (standalone — no other bugs affected):**
```js
const cancelBooking = async (req, res) => {
  try {
    // Verify ownership first
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("host_id, guest_id")
      .eq("id", req.params.id)
      .single();

    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (req.user.id !== booking.host_id && req.user.id !== booking.guest_id) {
      return res.status(403).json({ message: "Not authorized to cancel this booking" });
    }

    const { data, error } = await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
```
Apply the same ownership check to `completeBooking` (host only — guests should not be able to mark their own booking complete).

---

### BUG-02 · Payment always fails for guest (OTP) bookings — `guest_email` not sent
**Affects:** User  
**Files:**  
- `client/src/pages/ServiceBooking.jsx` — `handlePayment` (line 342)  
- `server/controllers/paymentController.js` — `createOrder` (line ~35)

**Problem:**  
For paid services, after OTP verification the frontend calls:
```js
const { data: order } = await createPaymentOrder({
  booking_id: confirmation.id,
  // ← guest_email is NOT sent
});
```
The server enforces: `isAuthenticatedGuest` (needs `req.user`, but the route has no `protect` middleware so `req.user` is always `null`) OR `isEmailGuest` (needs `guest_email` in request body, which is never sent).  

**Result:** Every paid-service booking via the OTP guest flow returns `403 "Not authorized to pay for this booking."` — paid services are completely broken for anonymous/guest users.

**Fix (standalone):**  
In `ServiceBooking.jsx`, pass `guest_email`:
```js
const { data: order } = await createPaymentOrder({
  booking_id: confirmation.id,
  guest_email: email,   // ← add this line
});
```

---

### BUG-03 · Global security middleware defined but never applied
**Affects:** All  
**Files:**  
- `server/middleware/security.js` — exports `helmetMiddleware`, `apiLimiter`, `speedLimiter`, `hppMiddleware`, `sanitizeBody`, `blockSuspiciousRequests`  
- `server/server.js` — never imports `security.js`

**Problem:**  
The security module is comprehensive (Helmet, global rate limiting, XSS cleaning, HPP protection), but `server.js` never loads it. The entire API is unprotected from DDoS, XSS payloads in request bodies, and HTTP Parameter Pollution. Only `authLimiter` and `otpLimiter` are applied (in individual route files).

**Fix (standalone — add to `server/server.js` after `app.use(express.json())`):**
```js
const {
  helmetMiddleware, apiLimiter, speedLimiter,
  hppMiddleware, sanitizeBody, blockSuspiciousRequests,
} = require('./middleware/security');

app.use(helmetMiddleware);
app.use(hppMiddleware);
app.use(sanitizeBody);
app.use(blockSuspiciousRequests);
app.use(speedLimiter);
app.use('/api', apiLimiter);
```
> ⚠️ Do NOT apply `blockSuspiciousRequests` before it — `sanitizeBody` should run first so the pattern-check sees clean data. Apply in the order shown above.

---

## HIGH SEVERITY BUGS 🟠

---

### BUG-04 · Explorer plan limit bypassed by new `/api/services` route
**Affects:** Vendor  
**Files:**  
- `server/routes/serviceRoutes.js` (line 14): `router.post('/', protect, createService)` — no plan check  
- `server/routes/hostRoutes.js` (line 11): `router.post('/services', protect, attachPlan, checkServiceLimit, createService)` — has plan check

**Problem:**  
The new dashboard (`ServiceForm.jsx`) uses `svcCreate` → `POST /api/services`. This route has no `attachPlan` or `checkServiceLimit` middleware. Explorer-plan vendors can create unlimited services through the new UI, completely bypassing the 3-service cap.

**Fix (standalone — `server/routes/serviceRoutes.js`):**
```js
const { attachPlan, checkServiceLimit } = require('../middleware/planMiddleware');

router.post('/', protect, attachPlan, checkServiceLimit, createService); // add middlewares
```

---

### BUG-05 · `updateProfile` always forces role to `'host'`, silently upgrading guest accounts
**Affects:** User, Vendor  
**File:** `server/controllers/hostController.js` — `updateProfile` (line 144)

**Problem:**  
```js
const updates = { role: "host", updated_at: new Date().toISOString() };
```
Every call to `PUT /api/host/profile` sets `role = "host"` regardless of the caller's existing role. A `guest` user who visits `/dashboard/profile` and saves any change is silently promoted to `host`, gaining unintended access to vendor features.

**Fix (standalone):**  
Remove `role: "host"` from the `updates` object. Role changes should only happen at registration or via the Admin panel.
```js
const updates = { updated_at: new Date().toISOString() };
// remove the role: "host" line
```

---

### BUG-06 · `resetPassword` uses `listUsers()` — fails for platforms with >1,000 users
**Affects:** All  
**File:** `server/controllers/authController.js` — `resetPassword` (line ~504)

**Problem:**  
```js
const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
const authUser = users.find((u) => u.email?.toLowerCase() === normalizedEmail);
```
`listUsers()` is paginated and only returns the first 1,000 users. On a larger platform, users whose auth record falls outside page 1 will receive "User not found" even with a valid reset code.

**Fix (standalone):**  
The OTP record's email can be used to find the profile ID, which is the same as the Supabase auth user ID:
```js
// Replace the listUsers block with:
const { data: profile } = await supabaseAdmin
  .from("profiles")
  .select("id")
  .eq("email", normalizedEmail)
  .single();

if (!profile) return res.status(404).json({ message: "User not found." });

const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
  profile.id, { password: newPassword }
);
```

---

### BUG-07 · Admin email change only updates `profiles` table, breaking login
**Affects:** Admin  
**File:** `server/controllers/adminController.js` — `updateUser` (line ~50)

**Problem:**  
When admin changes a user's email via `PUT /api/admin/users/:id`, only the `profiles` table is updated. The Supabase Auth record retains the old email. The user can no longer log in with the new email, and login with the old email still works but the profile shows the new one — data is split.

**Fix (standalone — in `adminController.js` `updateUser`):**
```js
if (email !== undefined) {
  updates.email = email;
  // Also update Supabase Auth
  await supabaseAdmin.auth.admin.updateUserById(req.params.id, { email });
}
```

---

### BUG-08 · No JWT token refresh — users silently lose session after 1 hour
**Affects:** Vendor, User, Admin  
**File:** `client/src/services/api.js`

**Problem:**  
Supabase JWTs expire in 1 hour. The `refresh_token` is stored in `localStorage` but never used. After expiry, all API calls return `401`, but the app still shows the user as "logged in" (local state from `localStorage`). Users experience mysterious failures with no redirect to login.

**Fix (standalone — add to `client/src/services/api.js`):**
```js
import supabase from './supabaseClient';

API.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      const user = JSON.parse(localStorage.getItem('user'));
      if (user?.refresh_token) {
        const { data, error: refreshError } = await supabase.auth.refreshSession({
          refresh_token: user.refresh_token,
        });
        if (!refreshError && data.session) {
          const updated = { ...user, token: data.session.access_token, refresh_token: data.session.refresh_token };
          localStorage.setItem('user', JSON.stringify(updated));
          error.config.headers.Authorization = `Bearer ${data.session.access_token}`;
          return API.request(error.config); // retry original request
        }
      }
      // Refresh failed — clear session
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

### BUG-09 · Admin "Platform Revenue" stat shows vendor earnings, not platform fees
**Affects:** Admin  
**File:** `server/controllers/adminController.js` — `getStats` (line ~25)

**Problem:**  
```js
const revenue = allBookings
  .filter(b => b.payment_status === 'paid')
  .reduce((s, b) => s + (b.services?.price || 0), 0);
```
This sums service prices (which go to vendors), labelled as "Platform Revenue" in the admin overview. The actual platform revenue is the sum of `platform_fee_amount` collected.

**Fix (standalone):**
```js
const revenue = allBookings
  .filter(b => b.payment_status === 'paid')
  .reduce((s, b) => s + (b.platform_fee_amount || 0), 0);
```

---

### BUG-10 · Admin Settings "Platform Fee %" saved but never enforced
**Affects:** Admin, User  
**Files:**  
- `client/src/pages/admin/AdminSettings.jsx` — renders and saves `platform_fee_percent`  
- `server/controllers/paymentController.js` — `const PLATFORM_FEE = 10;` (hardcoded)

**Problem:**  
Admin can change the "Platform Fee (%)" setting and it saves to `platform_settings`, but `paymentController.js` ignores it entirely and uses a hardcoded `₹10` flat fee. The settings UI is completely non-functional.

**Fix (standalone — `paymentController.js` `createOrder`):**
```js
// At the top of createOrder, fetch the fee setting:
const { data: feeSetting } = await supabaseAdmin
  .from('platform_settings')
  .select('value')
  .eq('key', 'platform_fee_percent')
  .single();
const feePercent = feeSetting ? parseFloat(JSON.parse(feeSetting.value)) : 0;
const platformFee = Math.round(servicePrice * feePercent / 100);
// Use platformFee instead of hardcoded PLATFORM_FEE
```
> Note: This also requires changing `PLATFORM_FEE = 10` (flat) to a percentage model, which should be consistent with what the admin UI implies. Update the label in `AdminSettings.jsx` to clarify it's a percentage, not flat amount.

---

## MEDIUM SEVERITY BUGS 🟡

---

### BUG-11 · Payment screen shows wrong amount — guest charged ₹10 more than displayed
**Affects:** User  
**File:** `client/src/pages/ServiceBooking.jsx` — payment step (line ~420)

**Problem:**  
```jsx
<span className="text-indigo-600">₹{service.price}</span>
// and
`Pay ₹${service.price} with Razorpay`
```
The Razorpay order is created for `(service.price + PLATFORM_FEE) * 100` paise, so the guest is charged `service.price + ₹10` but the UI shows only `service.price`. This is a consumer-facing transparency issue.

**Fix (standalone):**
```jsx
const totalCharged = service.price + 10; // or fetch from order response
// Replace in payment step:
<span>₹{service.price} + ₹10 platform fee</span>
<span className="font-bold">Total: ₹{totalCharged}</span>
// Button:
`Pay ₹${totalCharged} with Razorpay`
```
Better: use `order.amount / 100` (returned by the API) as the single source of truth for what will be charged.

---

### BUG-12 · Booking confirmation email sent before payment is completed (for paid services)
**Affects:** User, Vendor  
**File:** `server/controllers/bookingController.js` — `createBooking` (line ~170)

**Problem:**  
After creating a paid booking (`status: 'pending'`, `payment_status: 'unpaid'`), the code immediately sends both the guest and host confirmation emails saying "Your appointment is set" / "A new client has booked you". The guest gets a confirmation for an unpaid slot, and the host thinks a confirmed booking arrived when payment may never complete.

**Fix (standalone):**  
Move email sending from `createBooking` to `verifyPayment` (after `payment_status` is set to `paid`). For free services (`price === 0`), keep sending from `createBooking` as now.
```js
// In createBooking — only send email for FREE services:
if (service.price === 0) {
  // ... send emails as current
}
// In verifyPayment — send confirmation emails after marking paid:
// ... send guest + host confirmation emails here
```

---

### BUG-13 · Timezone mismatch — time slots shown in host timezone but booking saved in browser local time
**Affects:** User  
**File:** `client/src/pages/ServiceBooking.jsx` — `getTimeSlots` and `handleVerifyAndBook`

**Problem:**  
Available time slots are labelled with the host's timezone abbreviation (`IST`, `PST`, etc.), giving guests the impression they're selecting a time in the host's timezone. However:
```js
const sStart = new Date(
  selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), h, m
);  // ← uses browser local timezone, NOT hostTz
```
And in `handleVerifyAndBook`:
```js
const scheduledAt = new Date(
  selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(),
  ...selectedTime.split(":").map(Number),
).toISOString(); // ← local time converted to UTC
```
If a guest in EST selects "10:00 AM" for a host in IST, the booking is saved as 10:00 AM EST (not 10:00 AM IST). For hosts and guests in different timezones, every booking is at the wrong time.

**Fix (requires frontend timezone library like `date-fns-tz` or `luxon`):**
```js
import { fromZonedTime } from 'date-fns-tz';

// In handleVerifyAndBook:
const localDt = new Date(
  selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(),
  ...selectedTime.split(":").map(Number),
);
// Convert from host's timezone to UTC
const scheduledAt = fromZonedTime(localDt, hostTz).toISOString();
```

---

### BUG-14 · Vendor Reschedule modal ignores host availability schedule
**Affects:** Vendor  
**File:** `client/src/pages/Bookings.jsx` — `RescheduleModal`

**Problem:**  
The reschedule modal shows a calendar + a plain `<input type="time">`, allowing the vendor to reschedule to any arbitrary time (e.g. 3 AM on a Sunday). The server only validates no double-booking — it doesn't check if the new time falls within the host's availability windows.

**Fix (standalone):**  
Fetch availability in `RescheduleModal` and generate slots the same way `ServiceBooking.jsx` does, replacing the free-text time input with slot buttons:
```jsx
const [availSlots, setAvailSlots] = useState([]);
useEffect(() => {
  if (!selDate) return;
  getAvailability().then(({ data }) => {
    // generate slots from data.weekly_schedule for selDate
    setAvailSlots(generateSlots(data, selDate, booking.services?.duration));
  });
}, [selDate]);
```

---

### BUG-15 · `purchase_count` race condition on concurrent product purchases
**Affects:** User, Vendor  
**File:** `server/controllers/paymentController.js` — `verifyProductPayment` (line ~170)

**Problem:**  
```js
await supabaseAdmin.from("products")
  .update({ purchase_count: product.purchase_count + 1 })
  .eq("id", product_id);
```
This is a read-modify-write. Under concurrent purchases the count can be wrong (two requests both read `5`, both write `6`, actual should be `7`).

**Fix (standalone — use a Supabase RPC for atomic increment or use raw SQL):**
```js
await supabaseAdmin.rpc('increment_product_purchase_count', { product_id });
```
Create the DB function once:
```sql
CREATE OR REPLACE FUNCTION increment_product_purchase_count(product_id uuid)
RETURNS void AS $$
  UPDATE products SET purchase_count = purchase_count + 1 WHERE id = product_id;
$$ LANGUAGE sql;
```

---

### BUG-16 · Logged-in users must still complete OTP flow to book
**Affects:** User  
**File:** `client/src/pages/ServiceBooking.jsx` — `handleSendOtp`, booking flow

**Problem:**  
The booking flow always proceeds through OTP (send → verify) regardless of whether the user is already authenticated. A logged-in user is forced to request and enter a verification code for their own email, adding unnecessary friction. Worse, the booking ends up using the OTP-verified profile rather than the authenticated session.

**Fix (standalone — in `ServiceBooking.jsx`):**
```jsx
// Skip OTP for logged-in users
const handleContinueFromDetails = async () => {
  if (user) {
    // Logged-in: book directly without OTP
    await bookDirectly();
  } else {
    await handleSendOtp();
  }
};

const bookDirectly = async () => {
  // same logic as handleVerifyAndBook but skip verifyOtp call,
  // use user._id as guest_id
  const scheduledAt = /* ... */;
  const { data: bookingResult } = await createBooking({
    service_id: service.id,
    host_id: host.id,
    guest_id: user._id,
    guest_name: `${firstName} ${lastName}`.trim(),
    guest_email: email,
    guest_phone: phone,
    scheduled_at: scheduledAt,
    notes,
  });
  // ...
};
```

---

### BUG-17 · Vendor signup has no password confirmation field
**Affects:** Vendor  
**File:** `client/src/pages/VendorSignup.jsx`

**Problem:**  
Only a single password field exists. A typo in the password produces an account the user cannot log into (password is valid but unknown to them). The `minLength={6}` is client-side only — the server enforces nothing.

**Fix (standalone):**  
Add a "Confirm Password" field and validate before submit:
```jsx
const [confirmPassword, setConfirmPassword] = useState("");
// In handleSubmit:
if (form.password !== confirmPassword) {
  toast.error("Passwords do not match");
  return;
}
```
Same fix should apply to `UserSignup.jsx`.

---

### BUG-18 · Guest users see a vendor-focused dashboard after login
**Affects:** User  
**Files:** `client/src/pages/Login.jsx`, `client/src/pages/Dashboard.jsx`

**Problem:**  
After login, all users are redirected to `/dashboard` regardless of role. Guest (`role: 'guest'`) users see "Want to offer services? Become a Host." — there's no view of their own bookings (as a guest). The `getGuestBookings` API endpoint exists but is never shown in the dashboard.

**Fix (standalone — `client/src/pages/Login.jsx`):**
```js
const data = await login(form.email, form.password);
navigate(data.role === 'host' || data.role === 'superadmin' ? '/dashboard' : '/my-bookings');
```
Create a simple `/my-bookings` page that calls `getGuestBookings()` and lists the user's bookings.

---

### BUG-19 · `Bookings.jsx` — `now` is captured at mount time, not live
**Affects:** Vendor  
**File:** `client/src/pages/Bookings.jsx` (line ~195)

**Problem:**  
```js
const now = new Date(); // captured when component mounts
const filtered = useMemo(() => {
  // uses `now` which never updates
  list.filter(b => new Date(b.scheduled_at) > now)
}, [bookings, filter, search]); // `now` not in deps
```
A booking at 11:59 PM would show as "upcoming" if the page was loaded before midnight and remains open after — it will never move to "past" until a page reload.

**Fix (standalone):**  
Move `now` inside the `useMemo`:
```js
const filtered = useMemo(() => {
  const now = new Date(); // recalculated every time deps change
  let list = bookings;
  if (filter === "upcoming")
    list = list.filter(b => b.status !== "cancelled" && new Date(b.scheduled_at) > now);
  // ...
}, [bookings, filter, search]);
```

---

### BUG-20 · Admin mobile panel is inaccessible (no mobile navigation)
**Affects:** Admin  
**File:** `client/src/components/common/AdminLayout.jsx`

**Problem:**  
The admin sidebar uses `hidden md:flex` — it's hidden on screens smaller than `md` (768px) with no mobile alternative. Admins on phones or tablets cannot navigate between admin sections at all.

**Fix (standalone):**  
Add a mobile top bar with a hamburger menu, similar to `DashboardLayout.jsx`'s mobile bottom nav:
```jsx
// Add state
const [menuOpen, setMenuOpen] = useState(false);
// Add mobile header
<div className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
  <span className="font-bold text-sm">Super Admin</span>
  <button onClick={() => setMenuOpen(m => !m)}>☰</button>
</div>
{menuOpen && (
  <div className="md:hidden fixed inset-0 bg-gray-900 text-white z-50 flex flex-col p-4 gap-2">
    {NAV.map(item => <NavLink key={item.to} to={item.to} onClick={() => setMenuOpen(false)}>{item.label}</NavLink>)}
  </div>
)}
```

---

## LOW SEVERITY / CODE QUALITY 🟢

---

### BUG-21 · Dead code — `unusedVerifyOtp` function in `authController.js`
**File:** `server/controllers/authController.js` (line ~185)

`unusedVerifyOtp` is identical to `verifyOtp` and is never exported or used. Remove it to avoid confusion.

---

### BUG-22 · `Admin Settings` panel shows "Platform Fee (%)" but fee is actually flat ₹10
**File:** `client/src/pages/admin/AdminSettings.jsx`

Even before implementing BUG-10's fix, the label says "%" while the actual payment controller uses a flat ₹10 figure. The label is misleading. Change to "Platform Fee (flat ₹)" or fix BUG-10.

---

### BUG-23 · Admin can promote any user to `superadmin` with no confirmation or audit
**File:** `client/src/pages/admin/AdminUsers.jsx`

The role dropdown includes `superadmin` as an option with no confirmation dialog and no audit log. A misclick can grant superadmin to any user.

**Fix:** Add a confirmation modal for the `superadmin` role change, and log the action via `auditLog` in `adminController.js`.

---

## INTERDEPENDENCY MAP

If fixing multiple bugs together, follow this order to avoid conflicts:

| Fix Order | Bug | Reason |
|-----------|-----|--------|
| 1 | BUG-10 (platform fee %) | Changes fee calculation — do before BUG-02 fix |
| 2 | BUG-02 (pass guest_email) | Simple one-liner, no deps |
| 3 | BUG-03 (security middleware) | Add to server.js before route handlers |
| 4 | BUG-01 (cancel/complete ownership) | Independent DB check |
| 5 | BUG-12 (email timing) | After BUG-02 — both touch booking creation flow |
| 6 | BUG-13 (timezone fix) | After BUG-16 (skip OTP) — both touch `handleVerifyAndBook` |
| 7 | BUG-16 (skip OTP for logged-in) | Together with BUG-13 since both modify the booking step |
| 8 | BUG-06 (resetPassword) | Independent auth fix |
| 9 | BUG-04 (plan limit) | One-line route change, independent |
| 10 | BUG-05 (role force) | One-line removal, independent |

BUG-07, BUG-08, BUG-09, BUG-11, BUG-14, BUG-15, BUG-17–23 are each fully standalone.

