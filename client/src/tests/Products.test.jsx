/**
 * tests/Products.test.jsx
 * Vitest: oversized product file blocked pre-submit (no upload call);
 * thumbnail live-preview renders from a pasted image URL.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  getMyProducts: vi.fn().mockResolvedValue({ data: [] }),
  createProduct: vi.fn().mockResolvedValue({ data: {} }),
  updateProduct: vi.fn().mockResolvedValue({ data: {} }),
  deleteProduct: vi.fn().mockResolvedValue({ data: {} }),
  uploadProductFile: vi.fn().mockResolvedValue({ data: { url: 'https://cdn/x.pdf', name: 'x.pdf', size: 10 } }),
  uploadImage: vi.fn().mockResolvedValue({ data: { url: 'https://cdn/thumb.png' } }),
  getPublicPlans: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { default: toast, Toaster: () => null };
});

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../components/common/BackButton', () => ({ default: () => <div>Back</div> }));
// useFeature drives the admin kill-switch gate. Default ON; a test flips it OFF
// to assert the kill-switch branch (distinct from the plan-tier gate).
vi.mock('../context/FeatureContext', () => ({ useFeature: vi.fn(() => true) }));

import { useAuth } from '../context/AuthContext';
import { useFeature } from '../context/FeatureContext';
import { uploadProductFile, getPublicPlans, createProduct } from '../services/api';
import toast from 'react-hot-toast';
import Products from '../pages/Products';

// Reset mock call-counts before every test so assertions like
// expect(uploadProductFile).not.toHaveBeenCalled() cannot false-positive
// from a prior test's call. clearAllMocks leaves mockResolvedValue
// implementations intact, so no re-establishment is needed.
beforeEach(() => {
  vi.clearAllMocks();
  // Re-establish the default-ON kill switch so a prior test's OFF override
  // (mockReturnValue) can't leak into the next test.
  useFeature.mockReturnValue(true);
});

// jsdom has no URL.createObjectURL; the thumbnail-upload preview uses it.
beforeAll(() => {
  if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:preview';
  else vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
});

const renderProducts = async (plan = 'creator') => {
  useAuth.mockReturnValue({ user: { plan }, updateUser: vi.fn() });
  render(<MemoryRouter><Products /></MemoryRouter>);
  // Wait for the initial fetchProducts() effect to settle.
  await waitFor(() => expect(screen.getByText(/Digital Products/i)).toBeTruthy());
};

const openForm = async () => {
  const u = userEvent.setup();
  await u.click(screen.getByRole('button', { name: /add product/i }));
  await waitFor(() => expect(screen.getByText(/New Product/i)).toBeTruthy());
  return u;
};

describe('Products — file upload guard', () => {
  test('blocks an oversized (>2MB) file before calling uploadProductFile', async () => {
    await renderProducts('creator');
    await openForm();

    // Build a >2MB pdf File.
    const bigData = new Uint8Array(2 * 1024 * 1024 + 1);
    const bigFile = new File([bigData], 'big.pdf', { type: 'application/pdf' });

    const fileInput = document.querySelector('input[type="file"][data-testid="product-file-input"]');
    expect(fileInput).toBeTruthy();
    await fireEvent.change(fileInput, { target: { files: [bigFile] } });

    expect(uploadProductFile).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/under 2\s*MB/i)).toBeTruthy());
  });

  test('blocks a disallowed extension (.exe) before calling uploadProductFile', async () => {
    await renderProducts('creator');
    await openForm();

    const badFile = new File(['x'], 'malware.exe', { type: 'application/octet-stream' });
    const fileInput = document.querySelector('input[type="file"][data-testid="product-file-input"]');
    await fireEvent.change(fileInput, { target: { files: [badFile] } });

    expect(uploadProductFile).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/not supported|allowed/i)).toBeTruthy());
  });
});

describe('Products — validation error surfacing', () => {
  test('shows the specific field error from a 422 instead of generic "Validation failed"', async () => {
    createProduct.mockRejectedValueOnce({
      response: { data: { message: 'Validation failed', errors: [{ field: 'product_url', message: 'Invalid product URL' }] } },
    });
    await renderProducts('creator');
    await openForm();

    const titleInput = screen.getByPlaceholderText(/UI Component Kit/i);
    fireEvent.change(titleInput, { target: { value: 'My Guide' } });
    fireEvent.submit(titleInput.closest('form'));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls.at(-1)[0]).toMatch(/Invalid product URL/);
  });
});

describe('Products — thumbnail by URL', () => {
  test('renders a live preview img when an image URL is pasted', async () => {
    await renderProducts('creator');
    const u = await openForm();

    const urlInput = screen.getByPlaceholderText(/https:\/\/\.\.\.|paste an image url/i);
    await u.type(urlInput, 'https://cdn.example/cover.png');

    await waitFor(() => {
      const preview = document.querySelector('img[alt="Thumbnail preview"]');
      expect(preview).toBeTruthy();
      expect(preview.getAttribute('src')).toBe('https://cdn.example/cover.png');
    });
  });
});

// ── Plan-tier upgrade gate ────────────────────────────────────────────────────
// The gate is driven by the user's actual plan `digital_products` allowance from
// the DB (getPublicPlans), NOT a hardcoded slug. Any plan with a non-zero limit
// can create; only a true 0-allowance plan sees the gate. The CTA names the
// cheapest higher tier that includes products and carries no (drift-prone,
// previously-wrong "₹999/mo") price.

// Mirrors the prod subscription_plans config: every tier includes products.
const PLANS_REAL = [
  { slug: 'free',    name: 'Starter',      sort_order: 1, limits: { digital_products: 3 } },
  { slug: 'premium', name: 'Pro', sort_order: 2, limits: { digital_products: -1 } },
];
// A config where the free tier is genuinely blocked (0 allowance).
const PLANS_FREE_BLOCKED = [
  { slug: 'free',    name: 'Starter',      sort_order: 1, limits: { digital_products: 0 } },
  { slug: 'premium', name: 'Pro', sort_order: 2, limits: { digital_products: -1 } },
];

const renderWithPlan = (plan, plans) => {
  useAuth.mockReturnValue({ user: { plan }, updateUser: vi.fn() });
  getPublicPlans.mockResolvedValue({ data: plans });
  render(<MemoryRouter><Products /></MemoryRouter>);
};

describe('Products — plan-tier upgrade gate', () => {
  test('Professional plan (limit 20) is never prompted to upgrade', async () => {
    renderWithPlan('professional', PLANS_REAL);
    expect(await screen.findByRole('button', { name: /add product/i })).toBeTruthy();
    expect(screen.queryByText(/upgrade to/i)).toBeNull();
  });

  test('free tier with a real product allowance (limit 3) can create — no gate', async () => {
    renderWithPlan('starter', PLANS_REAL);
    expect(await screen.findByRole('button', { name: /add product/i })).toBeTruthy();
    expect(screen.queryByText(/upgrade to/i)).toBeNull();
  });

  test('a plan with a 0 product allowance shows the upgrade gate', async () => {
    renderWithPlan('starter', PLANS_FREE_BLOCKED);
    expect(await screen.findByText(/upgrade to pro/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /add product/i })).toBeNull();
  });

  test('legacy "explorer" slug resolves to the free tier for gating', async () => {
    renderWithPlan('explorer', PLANS_FREE_BLOCKED);
    expect(await screen.findByText(/upgrade to pro/i)).toBeTruthy();
  });

  test('upgrade CTA names the entry plan and carries no price label', async () => {
    renderWithPlan('explorer', PLANS_FREE_BLOCKED);
    const cta = await screen.findByText(/upgrade to pro/i);
    expect(cta.textContent.trim()).toBe('Upgrade to Pro');
    expect(cta.textContent).not.toMatch(/₹|\/mo|\/month|999/);
  });
});

// ── Admin kill-switch gate (digital_products feature OFF) ─────────────────────
// When the global kill switch is off, products are unavailable to EVERY plan.
// The gate must NOT show an "Upgrade to X" CTA — upgrading the plan can't unlock
// a globally-disabled feature. It shows a neutral "temporarily unavailable"
// notice instead. This is independent of, and takes precedence over, the
// plan-tier gate.
describe('Products — kill-switch gate (feature off)', () => {
  test('a Professional (plan allows products) sees the unavailable notice, no upgrade CTA', async () => {
    useFeature.mockReturnValue(false);
    renderWithPlan('professional', PLANS_REAL);
    expect(await screen.findByText(/temporarily unavailable/i)).toBeTruthy();
    expect(screen.queryByText(/upgrade to/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /add product/i })).toBeNull();
  });

  test('kill switch wins over the plan gate — a 0-allowance plan still sees the notice, not "Upgrade to Pro"', async () => {
    useFeature.mockReturnValue(false);
    renderWithPlan('starter', PLANS_FREE_BLOCKED);
    expect(await screen.findByText(/temporarily unavailable/i)).toBeTruthy();
    expect(screen.queryByText(/upgrade to pro/i)).toBeNull();
  });
});
