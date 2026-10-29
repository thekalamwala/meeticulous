# Admin Access Guide — Book A Sloth

## Overview
The admin panel is restricted to users with **`superadmin`** role. There are **3 ways to access admin**:

---

## **Method 1: Web Admin Dashboard (Easiest)**

### Prerequisites
1. Create a user account (register as guest or vendor)
2. Have your user role set to `superadmin` in the database

### Access Admin Panel
1. **Log in** with your account
2. Navigate to **`http://localhost:5173/admin`**
3. You'll see the Admin Dashboard with sections:
   - **Overview** — Platform stats (users, bookings, revenue)
   - **Users** — Manage all users, ban/verify, change roles
   - **Bookings** — View & manage all bookings
   - **Services** — View & delete services
   - **Settings** — Update platform settings

### ⚠️ Access Control
- If `user.role !== 'superadmin'`, you'll be redirected to `/dashboard`
- See line 16 in `AdminLayout.jsx`:
  ```javascript
  if (user?.role !== 'superadmin') return <Navigate to="/dashboard" replace />;
  ```

---

## **Method 2: Direct API Calls (Backend)**

### Base URL
```
http://localhost:3000/api/admin
```

### Required Headers
```
Authorization: Bearer <YOUR_JWT_TOKEN>
Content-Type: application/json
```

### Available Endpoints

#### **Stats**
```
GET /api/admin/stats
```
Returns: users, vendors, bookings, services, revenue, confirmed, cancelled

#### **Users Management**
```
GET /api/admin/users?role=all&search=john&page=1&limit=20
GET /api/admin/users/:userId
PUT /api/admin/users/:userId
DELETE /api/admin/users/:userId

Body for PUT:
{
  "role": "superadmin",           // Change role
  "is_verified": true,             // Verify user
  "is_banned": false,              // Ban user
  "admin_notes": "...",            // Add notes
  "name": "New Name",              // Edit profile
  "email": "new@email.com"
}
```

#### **Bookings Management**
```
GET /api/admin/bookings?status=confirmed&page=1&limit=20
PUT /api/admin/bookings/:bookingId
DELETE /api/admin/bookings/:bookingId

Body for PUT:
{
  "status": "completed",           // pending, confirmed, completed, cancelled
  "payment_status": "paid"         // paid, refunded
}
```

#### **Services Management**
```
GET /api/admin/services
DELETE /api/admin/services/:serviceId
```

#### **Settings**
```
GET /api/admin/settings
PUT /api/admin/settings

Body for PUT:
{
  "platform_commission": 10,
  "max_service_duration": 120,
  "require_email_verification": true
}
```

### Example cURL
```bash
curl -X GET http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## **Method 3: Database Direct Update (⚠️ Emergency Only)**

If you need to make a user superadmin **without logging in**:

### Option A: Using Supabase Dashboard
1. Go to **Supabase Console** → Your Project
2. Open **SQL Editor**
3. Run:
   ```sql
   UPDATE profiles 
   SET role = 'superadmin' 
   WHERE email = 'your-email@example.com';
   ```

### Option B: Using Node.js Script
Create `scripts/make-admin.js`:
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function makeAdmin(email) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'superadmin' })
    .eq('email', email)
    .select();
  
  if (error) console.error(error);
  else console.log('User made superadmin:', data);
}

makeAdmin('your-email@example.com');
```

Run: `node scripts/make-admin.js`

---

## **Admin Features Summary**

### Dashboard Overview
- **Total Users** — Count of guests
- **Total Vendors** — Count of hosts
- **Total Bookings** — All bookings
- **Total Services** — All available services
- **Revenue** — From paid bookings only
- **Confirmed/Cancelled** — Booking statistics

### User Management
- Search by name, email, or username
- Filter by role (guest, host, superadmin)
- Verify/ban users
- Change user roles
- Delete users (cascades to auth)
- Add admin notes

### Booking Management
- Filter by status (pending, confirmed, completed, cancelled)
- Update booking status
- Update payment status (paid, refunded)
- Delete bookings

### Service Management
- View all services with host info
- Delete services from platform

### Settings
- Manage platform-wide settings
- Key-value pairs stored in `platform_settings` table

---

## **Security Notes**

✅ **Protected by:**
- `protect` middleware — Requires valid JWT token
- `requireAdmin` middleware — Checks `role === 'superadmin'`
- All user tokens stripped of sensitive data (OTP, Google tokens)

⚠️ **Be Careful:**
- Only share admin credentials with trusted users
- Don't commit `.env` with `SUPABASE_SERVICE_KEY`
- Audit logs should be enabled in Supabase

---

## **Troubleshooting**

### "Superadmin access required"
- Check if user's role is actually `'superadmin'` in database
- Verify JWT token is valid
- Check `adminMiddleware.js` for exact role check

### API returns 401 Unauthorized
- Token expired → Re-login
- Token missing → Add `Authorization: Bearer <token>` header

### Dashboard redirects to /dashboard
- Your account doesn't have `role === 'superadmin'`
- Use Method 3 to update role in database

---

## **Quick Start Setup**

### 1. Register a user
```bash
POST http://localhost:3000/api/auth/register/guest
{
  "name": "Admin User",
  "email": "admin@example.com",
  "password": "secure_password"
}
```

### 2. Update their role to superadmin
```sql
UPDATE profiles SET role = 'superadmin' 
WHERE email = 'admin@example.com';
```

### 3. Log in
Navigate to `http://localhost:5173/login` and enter credentials

### 4. Access admin
Go to `http://localhost:5173/admin`

Done! 🎉
