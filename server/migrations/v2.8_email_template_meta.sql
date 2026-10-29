-- ============================================================
-- v2.8 — Email Template Meta: email_category + email_reason
--
-- Adds two display-metadata columns to email_templates:
--   email_category  short label shown in the email header chip
--                   (e.g. "Security Check", "Booking Confirmed")
--   email_reason    footer legal copy sent with every email
--                   (e.g. "You received this because…")
--
-- Safe to apply on a live DB — both columns are nullable with
-- empty-string defaults, so rows without values render cleanly.
--
-- After applying this migration, re-run:
--   node scripts/seedEmailTemplates.js
-- to push the new field values for all 29 seeded templates.
-- ============================================================

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS email_category TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email_reason   TEXT NOT NULL DEFAULT '';

-- Back-fill all 29 seeded event rows.
UPDATE email_templates SET
  email_category = CASE event_key
    WHEN 'BOOKING_OTP'                  THEN 'Security Check'
    WHEN 'AUTH_EMAIL_VERIFICATION'      THEN 'Security Check'
    WHEN 'PASSWORD_RESET'               THEN 'Security Check'
    WHEN 'SECURITY_PASSWORD_CHANGED'    THEN 'Security Alert'
    WHEN 'SECURITY_LOGIN_ALERT'         THEN 'Security Alert'
    WHEN 'BOOKING_CONFIRMED_CUSTOMER'   THEN 'Booking Confirmed'
    WHEN 'BOOKING_CONFIRMED_VENDOR'     THEN 'New Booking'
    WHEN 'BOOKING_REMINDER_CUSTOMER'    THEN 'Reminder'
    WHEN 'BOOKING_REMINDER_VENDOR'      THEN 'Reminder'
    WHEN 'BOOKING_CANCELLED_CUSTOMER'   THEN 'Booking Cancelled'
    WHEN 'BOOKING_CANCELLED_VENDOR'     THEN 'Booking Cancelled'
    WHEN 'BOOKING_COMPLETED_CUSTOMER'   THEN 'Session Complete'
    WHEN 'BOOKING_COMPLETED_VENDOR'     THEN 'Session Complete'
    WHEN 'BOOKING_RESCHEDULED_CUSTOMER' THEN 'Rescheduled'
    WHEN 'BOOKING_RESCHEDULED_VENDOR'   THEN 'Rescheduled'
    WHEN 'PROFILE_COMPLETION_REMINDER'  THEN 'Account Update'
    WHEN 'PROFILE_VERIFIED'             THEN 'Account Update'
    WHEN 'PROFILE_REJECTED'             THEN 'Account Update'
    WHEN 'BADGE_UNLOCKED'               THEN 'Achievement Unlocked'
    WHEN 'MILESTONE_FIRST_BOOKING'      THEN 'Achievement Unlocked'
    WHEN 'MILESTONE_10_BOOKINGS'        THEN 'Achievement Unlocked'
    WHEN 'MILESTONE_50_BOOKINGS'        THEN 'Achievement Unlocked'
    WHEN 'MILESTONE_100_BOOKINGS'       THEN 'Achievement Unlocked'
    WHEN 'SUBSCRIPTION_PURCHASED'       THEN 'Payment Receipt'
    WHEN 'SUBSCRIPTION_EXPIRING'        THEN 'Account Update'
    WHEN 'SUBSCRIPTION_RENEWED'         THEN 'Payment Receipt'
    WHEN 'BIRTHDAY'                     THEN 'Community Update'
    WHEN 'ACCOUNT_ANNIVERSARY'          THEN 'Community Update'
    WHEN 'VENDOR_WELCOME'               THEN 'Welcome'
    ELSE ''
  END,
  email_reason = CASE event_key
    WHEN 'BOOKING_OTP'
      THEN 'You are receiving this email because a sign-in verification was requested for your account.'
    WHEN 'AUTH_EMAIL_VERIFICATION'
      THEN 'You are receiving this email because a verification request was made for your account.'
    WHEN 'PASSWORD_RESET'
      THEN 'You are receiving this email because a password reset was requested for your account.'
    WHEN 'SECURITY_PASSWORD_CHANGED'
      THEN 'You are receiving this email because your account password was recently changed.'
    WHEN 'SECURITY_LOGIN_ALERT'
      THEN 'You are receiving this email because a new sign-in was detected on your account.'
    WHEN 'BOOKING_CONFIRMED_CUSTOMER'
      THEN 'You are receiving this email because you made a booking on Book A Sloth.'
    WHEN 'BOOKING_CONFIRMED_VENDOR'
      THEN 'You are receiving this email because you received a new booking on Book A Sloth.'
    WHEN 'BOOKING_REMINDER_CUSTOMER'
      THEN 'You are receiving this email as a reminder about your upcoming appointment.'
    WHEN 'BOOKING_REMINDER_VENDOR'
      THEN 'You are receiving this email as a reminder about an upcoming session.'
    WHEN 'BOOKING_CANCELLED_CUSTOMER'
      THEN 'You are receiving this email because a booking on your account was cancelled.'
    WHEN 'BOOKING_CANCELLED_VENDOR'
      THEN 'You are receiving this email because a booking was cancelled.'
    WHEN 'BOOKING_COMPLETED_CUSTOMER'
      THEN 'You are receiving this email because your session was marked as complete.'
    WHEN 'BOOKING_COMPLETED_VENDOR'
      THEN 'You are receiving this email because a session was marked complete on your account.'
    WHEN 'BOOKING_RESCHEDULED_CUSTOMER'
      THEN 'You are receiving this email because your booking was rescheduled.'
    WHEN 'BOOKING_RESCHEDULED_VENDOR'
      THEN 'You are receiving this email because a booking was rescheduled.'
    WHEN 'PROFILE_COMPLETION_REMINDER'
      THEN 'You are receiving this email because your Book A Sloth profile is incomplete.'
    WHEN 'PROFILE_VERIFIED'
      THEN 'You are receiving this email because your account verification status was updated.'
    WHEN 'PROFILE_REJECTED'
      THEN 'You are receiving this email because action is required on your account verification.'
    WHEN 'BADGE_UNLOCKED'
      THEN 'You are receiving this email because you earned a new achievement on Book A Sloth.'
    WHEN 'MILESTONE_FIRST_BOOKING'
      THEN 'You are receiving this email because you reached a booking milestone on Book A Sloth.'
    WHEN 'MILESTONE_10_BOOKINGS'
      THEN 'You are receiving this email because you reached a booking milestone on Book A Sloth.'
    WHEN 'MILESTONE_50_BOOKINGS'
      THEN 'You are receiving this email because you reached a booking milestone on Book A Sloth.'
    WHEN 'MILESTONE_100_BOOKINGS'
      THEN 'You are receiving this email because you reached a booking milestone on Book A Sloth.'
    WHEN 'SUBSCRIPTION_PURCHASED'
      THEN 'You are receiving this email because you made a purchase on Book A Sloth.'
    WHEN 'SUBSCRIPTION_EXPIRING'
      THEN 'You are receiving this email because your subscription is due to expire soon.'
    WHEN 'SUBSCRIPTION_RENEWED'
      THEN 'You are receiving this email because your Book A Sloth subscription was renewed.'
    WHEN 'BIRTHDAY'
      THEN 'You are receiving this email because you are a valued member of the Book A Sloth community.'
    WHEN 'ACCOUNT_ANNIVERSARY'
      THEN 'You are receiving this email because you are a valued member of the Book A Sloth community.'
    WHEN 'VENDOR_WELCOME'
      THEN 'You are receiving this email because you recently created a Book A Sloth host account.'
    ELSE ''
  END;
