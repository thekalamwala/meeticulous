-- v3.158_marketing_sender_aastha.sql
-- (v3.157 taken by PR #1066 campaign open/click metrics — bumped to avoid a clash.)
-- Point the marketing persona at the real Google Workspace mailbox that now sends
-- all bulk / sales-automation mail over SMTP (aastha@bookasloth.in), and rename its
-- visible identity Sujata → Aastha.
--
-- The sender_key stays 'sujata' on purpose: every email_templates row, lifecycle
-- sequence and CRM send that already references 'sujata' keeps resolving with no
-- code churn — ONLY the From name + address change. This also matches how Gmail /
-- Google Workspace SMTP behaves: it sends AS the authenticated mailbox, so the
-- marketing From must be aastha@ for bulk to deliver cleanly.
--
-- Additive, idempotent, schema-safe: if email_senders is absent the code falls
-- back to the global email_settings sender (senderRegistry fails open), and the
-- marketing SMTP provider forces From to MARKETING_SMTP_USER regardless, so this
-- was safe to deploy before the migration ran.
--
-- Apply on BOTH databases (prod Mumbai + staging Tokyo).

update email_senders
   set from_name  = 'Aastha | Marketing, Book A Sloth',
       from_email = 'aastha@bookasloth.in',
       reply_to   = 'aastha@bookasloth.in'
 where sender_key = 'sujata';
