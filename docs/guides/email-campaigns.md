# Guide: Sending an Email Campaign

A step-by-step for admins. No code needed.

## One-time setup
1. **Pick a bulk email sender.** Gmail/Workspace SMTP can't do volume (~500/day, spam risk). Go to **Admin → Communication → Settings**, set **Provider = Resend**, and make sure `RESEND_API_KEY` + a verified sender domain are configured on the server. Transactional OTP/booking mail can stay on SMTP.
2. **Verify it works.** Use the provider test (`POST /api/admin/email/test-provider` with your email, or the test button) and confirm the email lands.

## Sending a campaign
1. **Admin → Campaigns → Sync contacts.** This rebuilds the audience from users, bookings and buyers. Run it whenever you want fresh contacts.
2. **New campaign** → Channel = **Email**.
3. **Name** it (internal only).
4. **Audience** → pick a segment (e.g. "All guests", "Free-plan vendors"). The "≈ N consented recipients" line shows who will actually receive it (opted-in, not suppressed).
5. **Email template** → choose an active template (manage these under Communication → Templates). Optionally set a **subject override**.
6. **Save draft.**
7. **Launch** (from the list). Recipients are snapshotted and the campaign starts sending. It paces itself via the email queue; status moves draft → sending → sent.
8. **Track** the Sent/Total column. Failed sends retry automatically (5m/30m/2h).

## Notes
- Suppressed or opted-out contacts are **never** emailed — they're skipped automatically.
- Personalisation: template placeholders like `{{first_name}}` are filled from the contact.
- Want to stop emailing someone? Admin → Campaigns → contacts → toggle suppression (or they unsubscribe).

See also: [segments & consent](segments-and-consent.md), [architecture](../communication-campaigns-architecture.md).
