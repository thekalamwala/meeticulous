-- ============================================================
-- v3.198 — WhatsApp wiring for the new email tracks (campaign_name only)
-- ------------------------------------------------------------
-- Threads AiSensy campaign_name onto every event shipped in PR-3..PR-7.
-- WhatsApp stays OFF per event (whatsapp_enabled = false). Flip each row
-- individually in the admin / via SQL as the AiSensy template for that
-- campaign_name is approved:
--
--   UPDATE notification_events SET whatsapp_enabled = true
--    WHERE event_key = '<EVENT>';
--
-- Campaign naming convention matches the existing activation funnel
-- (v3.163) and PLAN_GIFT_* rows: Title Case - Audience, singular.
--
-- Template-param contract per event is documented in
-- docs/aisensy-template-spec.md. Services write that array into the send
-- call's data.templateParams; the engine picks campaign_name from this
-- row and forwards the params unchanged.
--
-- Empathy events (HOST_LOW_RATINGS_RUN, ACCOUNT_PAUSED_BY_USER) are
-- intentionally NOT wired for WhatsApp — these are private Shubham
-- notes that read as performative outside email. Same for
-- HOST_DORMANT_90D (final goodbye) and GUEST_REVIEW_LANDED (personal
-- confirmation after review posts).
--
-- Additive. Idempotent. APPLY to the Meeticulous DB after deploy.
-- ============================================================

UPDATE notification_events
   SET campaign_name = CASE event_key
         -- PR-4: review + KYC-start
         WHEN 'HOST_START_KYC_NUDGE'          THEN 'Start KYC - Vendor'
         WHEN 'GUEST_REVIEW_NUDGE'            THEN 'Review Request - Guest'

         -- PR-3: dormant (30d + 60d get WA; 90d stays email-only)
         WHEN 'HOST_DORMANT_30D'              THEN 'Dormant 30 Day - Vendor'
         WHEN 'HOST_DORMANT_60D'              THEN 'Dormant 60 Day - Vendor'

         -- PR-6: festivals (one campaign per event, all 'all' audience)
         WHEN 'GREETING_DIWALI'               THEN 'Greeting - Diwali'
         WHEN 'GREETING_HOLI'                 THEN 'Greeting - Holi'
         WHEN 'GREETING_EID'                  THEN 'Greeting - Eid'
         WHEN 'GREETING_CHRISTMAS'            THEN 'Greeting - Christmas'
         WHEN 'GREETING_NEWYEAR'              THEN 'Greeting - New Year'
         WHEN 'GREETING_PONGAL_SANKRANTI'     THEN 'Greeting - Pongal Sankranti'
         WHEN 'GREETING_ONAM'                 THEN 'Greeting - Onam'
         WHEN 'GREETING_INDEPENDENCE_DAY'     THEN 'Greeting - Independence Day'
         WHEN 'GREETING_REPUBLIC_DAY'         THEN 'Greeting - Republic Day'
         WHEN 'GREETING_TEACHERS_DAY'         THEN 'Greeting - Teachers Day'
         WHEN 'GREETING_MENTAL_HEALTH_DAY'    THEN 'Greeting - Mental Health Day'
         WHEN 'GREETING_YOGA_DAY'             THEN 'Greeting - Yoga Day'
         WHEN 'GREETING_WOMENS_DAY'           THEN 'Greeting - Womens Day'

         -- PR-7: human moments (celebration beats; GUEST_REVIEW_LANDED stays email-only)
         WHEN 'HOST_FIRST_REVIEW'             THEN 'First Review - Vendor'
         WHEN 'HOST_FIRST_FIVE_STAR'          THEN 'First Five Star - Vendor'
         WHEN 'HOST_PERFECT_MONTH'            THEN 'Perfect Month - Vendor'
         WHEN 'HOST_BOOKING_STREAK'           THEN 'Booking Streak - Vendor'
         WHEN 'HOST_FIRST_REPEAT'             THEN 'First Repeat Guest - Vendor'
         WHEN 'GUEST_EXPLORER_5_HOSTS'        THEN 'Explorer Five Hosts - Guest'
         WHEN 'GUEST_COMEBACK'                THEN 'Comeback - Guest'

         ELSE campaign_name
       END,
       updated_at = now()
 WHERE event_key IN (
   'HOST_START_KYC_NUDGE','GUEST_REVIEW_NUDGE',
   'HOST_DORMANT_30D','HOST_DORMANT_60D',
   'GREETING_DIWALI','GREETING_HOLI','GREETING_EID','GREETING_CHRISTMAS',
   'GREETING_NEWYEAR','GREETING_PONGAL_SANKRANTI','GREETING_ONAM',
   'GREETING_INDEPENDENCE_DAY','GREETING_REPUBLIC_DAY','GREETING_TEACHERS_DAY',
   'GREETING_MENTAL_HEALTH_DAY','GREETING_YOGA_DAY','GREETING_WOMENS_DAY',
   'HOST_FIRST_REVIEW','HOST_FIRST_FIVE_STAR','HOST_PERFECT_MONTH',
   'HOST_BOOKING_STREAK','HOST_FIRST_REPEAT','GUEST_EXPLORER_5_HOSTS',
   'GUEST_COMEBACK'
 );
