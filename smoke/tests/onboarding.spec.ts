import { test, expect, type Page } from '@playwright/test';

// Host-onboarding smoke test. The real Google OAuth handshake is
// un-stubbable end-to-end, so this spec fakes what happens AFTER the
// server callback: seeds a `user` session in localStorage and mocks every
// /api/onboarding/* response the flow depends on. We're checking that the
// screens still hang together — routing, form state, live preview
// wiring, confetti trigger, mark-complete — not that the backend writes.
// Server contracts get their own coverage from the endpoint auth probe.

const SLUG = 'smoke-host';
// Mutable state shared between routes so the guard sees consistent progression.
// `stepCompleted` bumps as save endpoints fire; `complete` flips only when
// mark-complete is called (matching the real server contract).
const STATE = { stepCompleted: 2, complete: false };

type Status = {
  slug: string;
  stepCompleted: number;
  isComplete: boolean;
  name: string;
  profileImage: string | null;
  primaryCategory: string | null;
};

const status = (): Status => ({
  slug: SLUG,
  stepCompleted: STATE.stepCompleted,
  isComplete: STATE.complete,
  name: 'Smoke Host',
  profileImage: null,
  primaryCategory: STATE.stepCompleted >= 3 ? 'life-coach' : null,
});

async function seedSession(page: Page) {
  // Set localStorage BEFORE any navigation so the axios interceptor picks it up.
  // The token can be a stub — every /api/onboarding/* call is intercepted.
  await page.addInitScript(() => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 'smoke-host-uuid',
        name: 'Smoke Host',
        email: 'smoke@example.test',
        token: 'smoke-token',
        refresh_token: 'smoke-refresh',
        is_host: true,
      }),
    );
  });
}

async function mockApi(page: Page) {
  await page.route('**/api/onboarding/status', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(status()) }),
  );

  await page.route('**/api/onboarding/save-persona', async (route) => {
    STATE.stepCompleted = Math.max(STATE.stepCompleted, 3);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.route('**/api/onboarding/save-details', async (route) => {
    STATE.stepCompleted = Math.max(STATE.stepCompleted, 5);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.route('**/api/onboarding/activate-free', async (route) => {
    STATE.stepCompleted = 6;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.route('**/api/onboarding/mark-complete', async (route) => {
    STATE.complete = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ onboarding_completed: true }) });
  });

  // PlansStep pulls the plan catalog and the current user for Razorpay prefill.
  await page.route('**/api/plans', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { slug: 'starter', name: 'Starter', monthly_price: 0, annual_price: 0, commission_percentage: 0,
          limits: { services: 5, bookings_per_year: 100 }, features: {}, support_type: 'email' },
        { slug: 'host_plus', name: 'Host+', monthly_price: 229, annual_price: 1499, commission_percentage: 0,
          limits: { services: 20, bookings_per_year: 1000 }, features: {}, support_type: 'chat' },
      ]),
    }),
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'smoke-host-uuid', name: 'Smoke Host', email: 'smoke@example.test' }) }),
  );

  // WhatsApp send-OTP path — never actually called in the "skip WA" branch
  // this spec takes, but stubbed for safety.
  await page.route('**/api/whatsapp/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) }),
  );
}

test.beforeEach(async ({ page }) => {
  STATE.stepCompleted = 2;
  STATE.complete = false;
  await seedSession(page);
  await mockApi(page);
});

test('happy path: claim → persona → preview → publish free → live → dashboard', async ({ page }) => {
  // ─── Persona picker ─────────────────────────────────────────────────
  await page.goto(`/vendor-register/${SLUG}/category`);
  await expect(page.getByRole('heading', { name: /how would you describe/i })).toBeVisible();
  await page.getByRole('radio', { name: /coach/i }).first().click();
  await page.getByRole('button', { name: /^continue$/i }).click();

  // ─── Preview step ───────────────────────────────────────────────────
  await expect(page).toHaveURL(new RegExp(`/vendor-register/${SLUG}/preview`));
  await expect(page.getByRole('heading', { name: /fill in a few details/i })).toBeVisible();
  // Live preview badge shows the persona label
  await expect(page.getByText(/^Coach$/)).toBeVisible();

  await page.getByPlaceholder(/helping first-time founders/i).fill('Helping smoke tests find their footing');
  await page.getByRole('button', { name: /^Solo$/ }).click();
  await page.getByRole('button', { name: /^Online$/ }).click();
  // Skip WhatsApp — button text changes to "Continue without WhatsApp"
  await page.getByRole('button', { name: /continue without whatsapp/i }).click();

  // ─── Publish moment ─────────────────────────────────────────────────
  await expect(page).toHaveURL(new RegExp(`/vendor-register/${SLUG}/plan`));
  await expect(page.getByRole('heading', { name: /you're one click from live/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /publish free/i })).toBeVisible();
  // Paid drawer is collapsed by default
  await expect(page.getByText(/see host\+ and studio plans/i)).toBeVisible();
  await page.getByRole('button', { name: /publish free/i }).click();

  // ─── /live celebration ──────────────────────────────────────────────
  await expect(page).toHaveURL(new RegExp(`/vendor-register/${SLUG}/live`));
  await expect(page.getByRole('heading', { name: /you're live!/i })).toBeVisible();
  await expect(page.getByText(new RegExp(`/${SLUG}$`))).toBeVisible();

  await page.getByRole('button', { name: /go to my dashboard/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test('resume: mid-flow host at step 4 lands on /preview via the guard', async ({ page }) => {
  STATE.stepCompleted = 4; // persona saved, preview pending
  await page.goto(`/vendor-register/${SLUG}/category`); // wrong route on purpose
  await expect(page).toHaveURL(new RegExp(`/vendor-register/${SLUG}/preview`));
  await expect(page.getByRole('heading', { name: /fill in a few details/i })).toBeVisible();
});

test('escape hatch: "None of these fit" opens the full category search', async ({ page }) => {
  await page.goto(`/vendor-register/${SLUG}/category`);
  await page.getByRole('button', { name: /none of these fit/i }).click();
  await expect(page).toHaveURL(new RegExp(`/vendor-register/${SLUG}/category/all`));
  await expect(page.getByRole('heading', { name: /what do you do\?/i })).toBeVisible();
});
