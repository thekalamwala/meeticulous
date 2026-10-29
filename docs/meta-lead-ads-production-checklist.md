# Meta Lead Ads → CRM — Production Checklist

The **code + webhook** are done and validated (see below). This checklist tracks the
remaining **Meta-side account/review work** needed before *real* Facebook/Instagram
Lead Ad submissions flow into the CRM. **None of this blocks the website lead form**
(`/be-a-sloth`), which is a fully independent production lead path.

App: **Timewheel BAS Com Web** — App ID `1769255080737297`
Dataset/Pixel: `3530370983781569` · Page: **bookasloth** `908528999000335` · Ad account `805768188521643`
Webhook URL: `https://book-a-sloth.onrender.com/api/webhooks/meta-leadgen`

## ✅ Already validated (do not redo)
- [x] `leadgen` + `leadgen_update` subscriptions active (Page object).
- [x] Callback URL verified by Meta.
- [x] Verify token works (correct token echoes challenge; wrong token → 403).
- [x] Meta dashboard test webhook reaches the endpoint (200).
- [x] X-Hub-Signature-256 signature verification works (`FB_APP_SECRET`).
- [x] Failed CRM creation on the dashboard test is **expected** — Meta used a fake
      `leadgen_id` (44444444444), which the Graph fetch correctly rejects.
- [x] `v3.137` (`leads.meta_lead_id`) applied on both DBs.

## ⬜ Remaining production work (Meta-side, not code)
Blocker: the app is in **Development mode**, so Meta delivers **no production leadgen
data** (even from admins/testers) until it is **published (Live)** *and* `leads_retrieval`
is approved.

1. [ ] **App icon** (1024×1024 PNG) — App → Settings → Basic.
2. [ ] **Privacy policy URL** — use `https://bookasloth.com/privacy` (page exists).
3. [ ] **User data deletion URL** — a data-deletion instructions page/URL
       (e.g. `https://bookasloth.com/privacy#data-deletion` or a dedicated page).
4. [ ] **App category** — App → Settings → Basic → Category (e.g. "Business & Pages").
5. [ ] **Switch app Development → Live** — top toggle (needs 1–4 done first).
6. [ ] **Submit + obtain App Review approval for `leads_retrieval`**
       — App → App Review → Permissions and Features. Requires a screencast + use-case
       description (reading lead form data into our CRM to contact the lead).
7. [ ] **Verify production Page/webhook subscription** — after going Live, confirm the
       **bookasloth** Page is still subscribed to the app and to the `leadgen` field.
8. [ ] **Test with a real Facebook Lead Ad submission**
       — Meta **Lead Ads Testing Tool** (or a live form Preview) → submit a real lead →
       confirm a `leads` row appears with `source = facebook_lead_ad` and `meta_lead_id`
       set, and the Meta `Lead` CAPI event fires (Events Manager → Test Events if
       `FB_TEST_EVENT_CODE` is set).

## Security follow-up
- [ ] **Rotate `FB_CAPI_ACCESS_TOKEN`** — it was shared in a chat during setup. Events
      Manager → dataset → Conversions API → Generate access token → update Render.
