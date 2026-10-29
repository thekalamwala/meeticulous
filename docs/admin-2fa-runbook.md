# Admin 2FA — Owner Runbook

This document is written for the Book A Sloth owner and is intentionally non-technical. You do not need to know how to code to follow any of these steps.

---

## What is admin 2FA?

Starting from the next release, every admin login requires **two things**:

1. Your **username and password** (same as before).
2. A **6-digit code** from an authenticator app on your phone — the code changes every 30 seconds.

This protects the admin panel even if someone guesses or steals a password. The authenticator app works offline, so you do not need internet on your phone to get the code.

**Recommended apps (free, either works):**
- Google Authenticator — [Android](https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2) / [iPhone](https://apps.apple.com/app/google-authenticator/id388497605)
- Authy — [Android](https://play.google.com/store/apps/details?id=com.authy.authy) / [iPhone](https://apps.apple.com/app/authy/id494168017)

Install one of these before you log in for the first time after the update.

---

## First-time setup (every admin, once after the update)

You only do this once. After that, daily login is quick.

1. Open the admin panel and log in with your **username and password** as usual.
2. You will see a page with a **QR code** (a square barcode).
3. Open your authenticator app → tap **+** or **Add account** → choose **Scan QR code** → point your camera at the QR code on screen.
4. The app will add a "Book A Sloth" entry and immediately start showing a 6-digit code.
5. Type that 6-digit code into the box on screen and click **Verify**.
6. You will see **8 recovery codes** — these are your backup if you ever lose your phone. **Write them down or save them somewhere safe** (a password manager, a secure notes app, a piece of paper in a locked drawer). Each code can only be used once. Do not skip this step.
7. Click **Done**. Setup is complete.

---

## Normal login (every day)

1. Go to the admin login page.
2. Enter your **username and password**, click **Log in**.
3. Open your authenticator app, find the **Book A Sloth** entry, and type the current **6-digit code** into the box.
4. Click **Verify**. You are in.

The code refreshes every 30 seconds. If it says "invalid code", just wait for a fresh code and try again.

---

## Lost your phone?

You still have your recovery codes (the 8 codes you saved during setup).

1. Log in with your username and password.
2. On the 2FA screen, click **Use a recovery code** (link below the code box).
3. Type one of your saved recovery codes and click **Verify**.
4. You are in. That one code is now used up — you have fewer remaining.
5. Once you have a new phone, go to **Admin → Security** and re-enroll your authenticator app so you go back to having a live code.

---

## Lost phone AND recovery codes (break-glass)

If you are completely locked out — no phone, no recovery codes — there are two ways to reset 2FA for that admin account. Either way, the admin will be asked to set up 2FA fresh on their next login.

### Option 1 — Supabase SQL Editor (easiest, no tech knowledge needed)

This is the recommended method because you already have access to the Supabase dashboard.

1. Go to [https://supabase.com](https://supabase.com) and log in with your Supabase account.
2. Open the **Book A Sloth project** from your project list.
3. In the left sidebar, click **SQL Editor**.
4. Click **New query** (top-left of the editor area).
5. Paste the following into the blank editor:

```sql
UPDATE admin_users
SET totp_enabled = false,
    totp_secret = NULL,
    totp_recovery_codes = NULL,
    totp_enrolled_at = NULL
WHERE username = 'superadmin';   -- change superadmin to the locked-out admin's username
```

6. Change `superadmin` in the last line to the exact username of the locked-out admin.
7. Click the green **Run** button (or press Ctrl+Enter / Cmd+Enter).
8. You should see a confirmation that 1 row was updated.
9. The admin can now log in with just their password and will be walked through 2FA setup again.

**This is safe** — only you have Supabase dashboard access, so only you can run this query.

---

### Option 2 — Server script (alternative for a developer)

If a developer has the server code and the `server/.env` file, they can run:

```
node server/scripts/reset-admin-2fa.js <username-or-email>
```

Replace `<username-or-email>` with the locked-out admin's username or email address. The script prints a confirmation and exits. The admin then logs in and re-enrolls.

---

## Before the first deploy — checklist for the owner

Before you (or your developer) push this update live, do these three things:

1. **Apply the database migration.**
   - Go to Supabase → SQL Editor → New query.
   - Open the file `server/migrations/v3.13_admin_2fa.sql` from the codebase and paste its contents into the editor.
   - Click **Run**. This adds the 2FA columns to the `admin_users` table. The site will not work correctly without this step.

2. **Tell all admins in advance.**
   - Every existing admin will be asked to set up 2FA the next time they log in after the update.
   - Give them a heads-up so they are not caught off guard, and make sure they have an authenticator app installed beforehand.

3. **Save your own recovery codes.**
   - You are likely the superadmin. Your recovery codes are your last resort. Keep them somewhere you will not lose them.

---

## Quick reference

| Situation | What to do |
|---|---|
| First login after update | Scan QR code with authenticator app, save recovery codes |
| Normal login | Password → 6-digit app code |
| No phone | Password → recovery code (click "Use a recovery code") |
| No phone and no recovery codes | Supabase SQL Editor → run the UPDATE query above |
| Reset another admin's 2FA | Same SQL Editor query, change the username |
