# Coding Rules — Book A Sloth

## General Principles
1. **Minimal exploration.** Use docs first, open code only for the specific change.
2. **Schema fallbacks.** Any query touching potentially-missing columns needs a fallback (see pattern below).
3. **Snapshots are immutable.** Once a booking is created, `vendor_amount`, `platform_fee_amount`, `commission_applied` must never be recalculated — read from the row.
4. **Pure pricing functions.** Never add DB access or side effects to `pricingEngine.js`.
5. **supabaseAdmin is server-only.** Never expose service role key or use it in client code.

---

## Server Patterns

### Schema Cache Fallback (SELECT)
```js
let result = await supabaseAdmin.from('bookings').select('*, new_column');
if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
  result = await supabaseAdmin.from('bookings').select('id, status, ...core_fields');
}
const { data, error } = result;
```

### Schema Cache Fallback (INSERT)
```js
const payload = { ...coreFields, new_column: value };
let result = await supabaseAdmin.from('table').insert(payload).select().single();
if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
  const { new_column: _dropped, ...safePayload } = payload;
  result = await supabaseAdmin.from('table').insert(safePayload).select().single();
}
const { data, error } = result;
```

### Controller Structure
```js
const myAction = async (req, res) => {
  try {
    // 1. validate inputs
    // 2. DB queries (with fallbacks if needed)
    // 3. business logic
    // 4. DB mutation
    // 5. async side effects (email, etc) in try/catch so they don't break response
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
```

### Route Protection
```js
router.post('/action', protect, handler);             // host/guest auth
router.post('/admin-action', adminProtect, handler);  // admin auth
router.post('/plan-action', protect, attachPlan, checkServiceLimit, handler); // with plan check
```

### Email Side Effects Pattern
Always wrap email/WhatsApp sends so failures don't break the main response:
```js
try {
  await sendEmail({ to, subject, html });
  await sendAppointmentWhatsApp({ phone, variables });
} catch (emailError) {
  console.error('Email error:', emailError.message);
  // Don't re-throw — booking still succeeded
}
```

### Email Template Helpers (bookingController.js)
```js
emailHtml(body)           // wraps content in BAS-styled email shell
row(label, value)         // <p><strong>Label:</strong> value</p>
button(href, label)       // styled CTA button
```

---

## Client Patterns

### API Calls
All calls go through `api.js` — never use `fetch` or create separate Axios instances.
```js
import { createBooking, getHostBookings } from '../services/api';
const { data } = await createBooking({ ... });
```

### Error Display
```js
toast.error(err.response?.data?.message || 'Fallback message');
```

### Auth Context Usage
```js
const { user, login, logout, updateUser } = useAuth();
// user = { id, name, email, role, username, plan, token, refresh_token, ... }
// user is null when logged out
```

### Theme Color Pattern (booking flow + public profile)
```js
import { DEFAULT_THEME_COLOR, getContrastColor, getPlanBorderColor, isValidHex } from '../utils/themeUtils';
const tc = host && isValidHex(host.theme_color) ? host.theme_color : DEFAULT_THEME_COLOR;
const textOnTheme = getContrastColor(tc);
const borderColor = getPlanBorderColor(host?.plan || 'explorer');
// Use inline style: style={{ background: tc, color: textOnTheme }}
```

### Protected Routes
All `/dashboard/*` routes use `DashboardWrapper`:
```jsx
<Route path="/dashboard/..." element={<DashboardWrapper><Page /></DashboardWrapper>} />
```
`DashboardWrapper` = `<ProtectedRoute><DashboardLayout>{children}</DashboardLayout></ProtectedRoute>`

### Routing Pattern
Use `useNavigate` for programmatic navigation, `Link` for declarative links.
```js
const navigate = useNavigate();
navigate('/dashboard/services');
```

### Form State
Simple `useState` per field — no form library currently in use.
```js
const [firstName, setFirstName] = useState('');
const [email, setEmail] = useState('');
```

---

## Naming Conventions

### Files
- React pages: `PascalCase.jsx` (e.g., `ServiceBooking.jsx`)
- Components: `PascalCase.jsx`
- Server controllers: `camelCaseController.js`
- Server routes: `camelCaseRoutes.js`
- Utils/lib: `camelCase.js`

### Variables
- Boolean flags: `is_active`, `is_verified`, `reminder_24h_sent`
- Timestamps: `*_at` suffix (e.g., `scheduled_at`, `created_at`, `plan_expires_at`)
- IDs: `*_id` suffix (e.g., `host_id`, `service_id`, `guest_id`)
- URLs: `*_url` suffix (e.g., `profile_image`, `thumbnail_url`, `meeting_link`)

### CSS Classes
- Custom utility classes: `fb-*` prefix (e.g., `fb-btn`, `fb-card`, `fb-input`)
- Tailwind utilities used directly — no custom component classes unless in `styles/components/`

### API Response Shape
Success: `res.json(data)` or `res.status(201).json(data)`
Error: `res.status(4xx/5xx).json({ message: '...' })`
Auth errors: `res.status(401).json({ message: 'Unauthorized' })`
Plan errors: `res.status(403).json({ message: '...', upgrade_required: true, current_plan: '...' })`

---

## Anti-Patterns (Never Do)
- ❌ Never call `supabaseAdmin` from the client
- ❌ Never hardcode `₹10` platform fee — use `calculatePlatformFee(bookingValue)`
- ❌ Never recalculate commission from current plan — read `booking.commission_applied`
- ❌ Never use `fetch()` for API calls — use `api.js` exports
- ❌ Never add `max-w-lg mx-auto` to step cards in ServiceBooking — use `max-w-md mx-auto` for inner content wrapper
- ❌ Never use `/profile/service/:slug` URL — correct booking URL is `/:username/booking/:slug`
- ❌ Never use in-memory store for OTP — use `otpStore.js` (DB-backed)
- ❌ Never skip the schema fallback on queries touching migration columns
- ❌ Never call `setInterval` in a React component for reminders — it's in `server.js`
