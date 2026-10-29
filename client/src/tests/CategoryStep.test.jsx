import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('../services/api', () => ({
  getCategories:       vi.fn(),
  suggestCategory:     vi.fn(),
  saveOnboardingPersona: vi.fn(() => Promise.resolve({ data: {} })),
  // useOnboardingGuard needs this; stepCompleted=3 → target='category' → guard sets ready=true
  getOnboardingStatus: vi.fn(() =>
    Promise.resolve({ data: { stepCompleted: 3, isComplete: false, slug: 'jane' } })
  ),
}));

// Redesigned guard redirects this legacy step; it has its own test — stub it ready.
vi.mock('../pages/onboarding/useOnboardingGuard', () => ({ default: () => true }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams:   () => ({ slug: 'jane' }),
  };
});

import {
  getCategories,
  suggestCategory,
  saveOnboardingPersona,
} from '../services/api';
import CategoryStep from '../pages/onboarding/CategoryStep';

// ── Fixtures ───────────────────────────────────────────────────────────────
const CATS = [
  { slug: 'life-coach',  label: 'Life Coach',  group_label: 'Coaching & Consulting' },
  { slug: 'ai-engineer', label: 'AI Engineer', group_label: 'Technology & Product'  },
];

beforeEach(() => {
  vi.clearAllMocks();
  getCategories.mockResolvedValue({ data: CATS });
  saveOnboardingPersona.mockResolvedValue({ data: {} });
  suggestCategory.mockResolvedValue({
    data: { slug: 'voice-coaching', label: 'Voice Coaching', status: 'pending' },
  });
  // Guard: pathname last-segment must match 'category'
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, pathname: '/vendor-register/jane/category' },
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────
const renderStep = () =>
  render(<MemoryRouter><CategoryStep /></MemoryRouter>);

/** Wait until the category list has rendered at least one item. */
const waitForCategories = () => screen.findByText('Life Coach');

// ── Tests ──────────────────────────────────────────────────────────────────

test('renders heading', async () => {
  renderStep();
  expect(await screen.findByText(/What do you do\?/i)).toBeTruthy();
});

test('(a) typing filters the list', async () => {
  renderStep();
  await waitForCategories();

  // Both visible initially
  expect(screen.getByText('Life Coach')).toBeTruthy();
  expect(screen.getByText('AI Engineer')).toBeTruthy();

  // Type 'life' — only Life Coach should remain in the scrollable list
  fireEvent.change(screen.getByPlaceholderText(/search categories/i), {
    target: { value: 'life' },
  });

  expect(screen.getByText('Life Coach')).toBeTruthy();
  expect(screen.queryByText('AI Engineer')).toBeNull();
});

test('(b) tapping a match selects it (shown as chip) and enables Continue', async () => {
  renderStep();
  await waitForCategories();

  // Continue is disabled before selection
  const continueBtn = screen.getByRole('button', { name: /continue/i });
  expect(continueBtn.disabled).toBe(true);

  // Tap "Life Coach" — it becomes the chip
  fireEvent.click(screen.getByText('Life Coach'));

  // The chip should appear (check aria-label on the remove button references the label)
  expect(screen.getByLabelText(/Remove Life Coach/i)).toBeTruthy();

  // Continue is now enabled
  expect(continueBtn.disabled).toBe(false);

  // Selecting another replaces the chip (single-select)
  fireEvent.click(screen.getByText('AI Engineer'));
  expect(screen.getByLabelText(/Remove AI Engineer/i)).toBeTruthy();
  expect(screen.queryByLabelText(/Remove Life Coach/i)).toBeNull();
});

test('(c) no-exact-match shows Add row; tapping it calls suggestCategory and auto-selects', async () => {
  renderStep();
  await waitForCategories();

  // Type something that doesn't match any label exactly
  fireEvent.change(screen.getByPlaceholderText(/search categories/i), {
    target: { value: 'Voice Coaching' },
  });

  // Add row should appear
  const addRow = await screen.findByTestId('add-custom-row');
  expect(addRow).toBeTruthy();
  // The row text contains the query
  expect(addRow.textContent).toMatch(/Voice Coaching/i);

  // Tap the Add row
  fireEvent.click(addRow);

  // suggestCategory should have been called with the typed query
  await waitFor(() =>
    expect(suggestCategory).toHaveBeenCalledWith('Voice Coaching')
  );

  // The new category is auto-selected and appears as a chip
  await waitFor(() =>
    expect(screen.getByLabelText(/Remove Voice Coaching/i)).toBeTruthy()
  );

  // "pending review" badge should be visible (status === 'pending')
  expect(screen.getByText(/pending review/i)).toBeTruthy();
});

test('(d) Continue saves the persona (step-3 batch writer, not a step-4 jump) then navigates to /preview', async () => {
  renderStep();
  await waitForCategories();

  // Select AI Engineer
  fireEvent.click(screen.getByText('AI Engineer'));

  // Click Continue
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));

  // Uses saveOnboardingPersona(slug) — which advances step = max(current, 3) —
  // so an escape-hatch host still at step 2 isn't rejected as an illegal jump.
  await waitFor(() => expect(saveOnboardingPersona).toHaveBeenCalledWith('ai-engineer'));

  await waitFor(() =>
    expect(mockNavigate).toHaveBeenCalledWith('/vendor-register/jane/preview')
  );
});

test('Continue is disabled while saving', async () => {
  // Make save hang so we can inspect the button mid-flight
  let resolveSave;
  saveOnboardingPersona.mockReturnValue(new Promise((r) => { resolveSave = r; }));

  renderStep();
  await waitForCategories();

  fireEvent.click(screen.getByText('Life Coach'));

  const continueBtn = screen.getByRole('button', { name: /continue/i });
  fireEvent.click(continueBtn);

  // While saving, button should be disabled
  await waitFor(() => expect(continueBtn.disabled).toBe(true));

  // Resolve save so the test doesn't leak a pending promise
  resolveSave({ data: {} });
});

test('save error re-enables Continue button', async () => {
  saveOnboardingPersona.mockRejectedValue({ response: { data: { message: 'DB error' } } });

  renderStep();
  await waitForCategories();

  fireEvent.click(screen.getByText('Life Coach'));
  const continueBtn = screen.getByRole('button', { name: /continue/i });
  fireEvent.click(continueBtn);

  await waitFor(() => expect(continueBtn.disabled).toBe(false));
});

// Single-select: replacing the pick sends only the final slug to the persona writer.
test('is single-select and saves the final primary category', async () => {
  renderStep();
  await waitForCategories();

  fireEvent.click(screen.getByText('Life Coach'));
  fireEvent.click(screen.getByText('AI Engineer')); // replace

  fireEvent.click(screen.getByRole('button', { name: /continue/i }));

  await waitFor(() => expect(saveOnboardingPersona).toHaveBeenCalledWith('ai-engineer'));
  expect(saveOnboardingPersona).toHaveBeenCalledTimes(1);
});
