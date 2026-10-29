# smoke

Isolated Playwright harness for the host-onboarding redesign.

## Setup

```bash
cd smoke
npm install
npm run setup   # installs Chromium (~150 MB, one-off)
```

## Run

Start the client dev server in another terminal:

```bash
npm run dev --prefix client
```

Then, from `smoke/`:

```bash
npm test
```

## What it covers

- Happy path: persona → preview → publish free → live → dashboard
- Guard: mid-flow host at `stepCompleted=4` resumes at `/preview`
- Escape hatch: "None of these fit" jumps to the classic category search

## What it does NOT cover

- Real Google OAuth handshake (un-stubbable). Every `/api/onboarding/*` call
  is mocked with `page.route()`; the spec verifies the client flow, not
  server writes.
- Razorpay paid flow.
- Confetti render (canvas is best-effort in headless).

Backend contract coverage lives in `server/tests`; endpoint auth gating is
verified by a curl probe (see the PR discussion for the redesign).
