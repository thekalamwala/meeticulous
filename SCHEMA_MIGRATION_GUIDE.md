# Schema Migration Guide

## Issue

The app is encountering Supabase schema cache errors for columns that exist in migrations but may not be deployed:
- `services.grace_period_minutes`
- `services.thumbnail_url`
- And other newer fields

## Root Cause

Supabase maintains a schema cache to validate queries before execution. When new columns are added via migrations, the cache may not refresh automatically, especially in development or if migrations were skipped during deployment.

## Solution

### 1. **Deploy Pending Migrations** (Required)

Run these SQL scripts in your Supabase SQL Editor in the order listed:

#### Step 1: `server/config/schema.sql`
The base schema with all current fields:
```
Dashboard → SQL Editor → New Query
Copy & paste entire contents → Run
```

#### Step 2: `server/migrations/v1.1.sql`
Base service features (OTP, reminders, thumbnails):
```
Copy & paste entire contents → Run
```

#### Step 3: `server/migrations/v1.2.sql`
Plans and products (subscription system):
```
Copy & paste entire contents → Run
```

#### Step 4: `server/config/migration_v2.sql`
Google OAuth and service meeting modes:
```
Copy & paste entire contents → Run
```

#### Step 5: `server/config/migration_v3.sql`
Profile enhancements and service slugs:
```
Copy & paste entire contents → Run
```

#### Step 6: `server/config/migration_v4_admin.sql`
Admin and superadmin support:
```
Copy & paste entire contents → Run
```

#### Step 7: `server/config/migration_v5_booking_reschedule.sql`
Booking reschedule and acknowledgement:
```
Copy & paste entire contents → Run
```

#### Step 8: `server/config/migration_v6_twilio_otp.sql`
WhatsApp OTP phone support:
```
Copy & paste entire contents → Run
```

### 2. **Refresh Schema Cache**

After running migrations:

1. **Option A: Restart Server** (Quickest)
   ```bash
   # In terminal
   cd server
   npm run dev
   # The Supabase client will re-initialize and fetch fresh schema
   ```

2. **Option B: Force Cache Clear** (Supabase Dashboard)
   - Go to your Supabase dashboard
   - Navigate to: Settings → Database → Schema
   - No explicit cache clear button exists, but a server restart forces it

3. **Option C: Verify Directly** (Supabase SQL)
   ```sql
   -- Check services table columns
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'services'
   ORDER BY ordinal_position;
   ```

## Current Fallback Protection

The app now includes automatic fallback logic:

- **Service Insert/Update**: If `grace_period_minutes` or `thumbnail_url` fail, they're removed and retry
- **Service Select**: If schema cache errors occur, queries fall back to core fields
- **Booking Queries**: Graceful degradation for newer fields

This means the app will work even with a stale schema, but won't store/retrieve the newer features.

## Testing After Migration

1. Create a new service with a grace period
2. Create a booking and verify no schema cache errors
3. Check server logs for any fallback warnings

## Additional Notes

- All migrations are idempotent (use `IF NOT EXISTS`) and safe to re-run
- The app will continue working if new columns are missing, but with reduced functionality
- Migration order matters—always run in sequence
- If you encounter "table does not exist" errors, ensure `schema.sql` ran first
