import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, test, expect, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Host360Detail from '../pages/admin/Host360Detail';

const HOST_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';

const overview = {
  host: { id: HOST_ID, name: 'Asha Rao', email: 'asha@example.com', username: 'asha', plan: 'creator', is_banned: false, is_verified: true, created_at: '2026-01-01T00:00:00Z' },
  counts: { services: 2, bookings: 10, customers: 4 },
  revenue: { total: 5000, lifetime: 5000, available: 1000, clearing: 0, paidOut: 4000 },
  recent_timeline: [],
  open_tickets: 0,
  red_flags: [],
  account_manager: null,
};

const docsPayload = {
  kyc: {
    status: 'approved', full_name: 'Asha Rao', phone: 'XXXXXX3210',
    pan_masked: 'XXXXXX234F', aadhaar_masked: 'XXXXXXXX1234', bank_masked: 'XXXXXX9012 · HDFC0001234',
    ifsc: 'HDFC0001234', created_at: '2026-02-01T00:00:00Z', reviewed_at: null, documents: [],
  },
  documents: [{ id: 'd1', name: 'signed-contract.pdf', doc_type: 'contract', created_at: '2026-03-01T00:00:00Z', url: 'https://signed/doc' }],
  documents_locked: false,
};

vi.mock('../services/api', () => ({
  adminHost360Get: vi.fn(() => Promise.resolve({ data: overview })),
  adminHost360Usage: vi.fn(() => Promise.resolve({ data: {} })),
  adminHost360Billing: vi.fn(() => Promise.resolve({ data: {} })),
  adminHost360Timeline: vi.fn(() => Promise.resolve({ data: { events: [] } })),
  adminHost360Support: vi.fn(() => Promise.resolve({ data: { tickets: [] } })),
  adminHost360Documents: vi.fn(() => Promise.resolve({ data: docsPayload })),
  adminHost360UploadDoc: vi.fn(() => Promise.resolve({ data: { document: { id: 'd2' } } })),
  adminHost360DeleteDoc: vi.fn(() => Promise.resolve({ data: { ok: true } })),
  adminHost360RevealKyc: vi.fn(() => Promise.resolve({ data: {
    pan_number: 'ABCDE1234F', aadhaar_number: '123412341234', account_number: '123456789012',
    phone: '9876543210', ifsc: 'HDFC0001234',
  } })),
  adminHost360Notes: vi.fn(() => Promise.resolve({ data: { notes: [] } })),
  adminHost360AddNote: vi.fn(), adminHost360UpdateNote: vi.fn(), adminHost360DeleteNote: vi.fn(),
  adminHost360Suspend: vi.fn(), adminHost360SetPlan: vi.fn(), adminHost360AssignAm: vi.fn(),
  adminHost360SendEmail: vi.fn(),
  adminHost360Managers: vi.fn(() => Promise.resolve({ data: { managers: [] } })),
}));

import { adminHost360Get, adminHost360Documents, adminHost360UploadDoc, adminHost360DeleteDoc, adminHost360RevealKyc } from '../services/api';

const setSession = (permissions) =>
  localStorage.setItem('bas_admin', JSON.stringify({ id: 'adm1', email: 'ops@meeticulous.in', permissions }));

const OPS = ['users.view', 'users.edit', 'kyc.view', 'kyc.decide', 'documents.view', 'documents.manage'];
const KYC_ONLY = ['users.view', 'kyc.view'];

const renderAt = (tab) => render(
  <MemoryRouter initialEntries={[`/admin/host360/${HOST_ID}${tab ? `?tab=${tab}` : ''}`]}>
    <Routes><Route path="/admin/host360/:hostId" element={<Host360Detail />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  adminHost360Get.mockResolvedValue({ data: overview });
  adminHost360Documents.mockResolvedValue({ data: docsPayload });
});

// ── View profile ────────────────────────────────────────────────
test('View profile links to the host public page in a new tab', async () => {
  setSession(OPS);
  renderAt();
  await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());

  const link = screen.getByText('View profile').closest('a');
  expect(link.getAttribute('href')).toBe('/asha');
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toBe('noreferrer');
});

test('View profile is disabled, not hidden, when the host has no username', async () => {
  setSession(OPS);
  adminHost360Get.mockResolvedValue({ data: { ...overview, host: { ...overview.host, username: null } } });
  renderAt();
  await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());

  const btn = screen.getByText('View profile').closest('button');
  expect(btn.disabled).toBe(true);
  expect(screen.getByText('View profile').closest('a')).toBe(null);
});

// ── KYC card: masked by default, reveal is deliberate ───────────
test('KYC renders masked values and does not fetch real PII on mount', async () => {
  setSession(OPS);
  renderAt('documents');
  await waitFor(() => expect(screen.getByText('XXXXXX234F')).toBeInTheDocument());

  expect(screen.getByText('XXXXXXXX1234')).toBeInTheDocument();
  expect(screen.getByText('XXXXXX9012 · HDFC0001234')).toBeInTheDocument();
  expect(adminHost360RevealKyc).not.toHaveBeenCalled(); // never on mount
});

test('Reveal swaps masked for real values, then Hide drops them again', async () => {
  setSession(OPS);
  renderAt('documents');
  await waitFor(() => expect(screen.getByText('XXXXXX234F')).toBeInTheDocument());

  fireEvent.click(screen.getByText('Reveal'));

  await waitFor(() => expect(screen.getByText('ABCDE1234F')).toBeInTheDocument());
  expect(adminHost360RevealKyc).toHaveBeenCalledWith(HOST_ID);
  expect(screen.getByText('123412341234')).toBeInTheDocument();
  expect(screen.queryByText('XXXXXX234F')).toBe(null);
  expect(screen.getByText(/recorded in the audit log/i)).toBeInTheDocument();

  fireEvent.click(screen.getByText('Hide'));

  await waitFor(() => expect(screen.getByText('XXXXXX234F')).toBeInTheDocument());
  expect(screen.queryByText('ABCDE1234F')).toBe(null); // real PII dropped from state
});

test('an admin without kyc.decide gets no reveal control at all', async () => {
  setSession(['users.view', 'kyc.view', 'documents.view']);
  renderAt('documents');
  await waitFor(() => expect(screen.getByText('XXXXXX234F')).toBeInTheDocument());
  expect(screen.queryByText('Reveal')).toBe(null);
});

test('a failed reveal keeps the masked values on screen', async () => {
  setSession(OPS);
  adminHost360RevealKyc.mockRejectedValueOnce({ response: { data: { message: 'Forbidden' } } });
  renderAt('documents');
  await waitFor(() => expect(screen.getByText('XXXXXX234F')).toBeInTheDocument());

  fireEvent.click(screen.getByText('Reveal'));

  await waitFor(() => expect(screen.getByText('Reveal')).toBeInTheDocument()); // back to idle
  expect(screen.getByText('XXXXXX234F')).toBeInTheDocument();
});

// ── Documents tab ───────────────────────────────────────────────
test('documents tab lists admin paperwork with a download link', async () => {
  setSession(OPS);
  renderAt('documents');
  await waitFor(() => expect(screen.getByText('signed-contract.pdf')).toBeInTheDocument());
  expect(screen.getByText('Download').getAttribute('href')).toBe('https://signed/doc');
  expect(screen.getByText('XXXXXX234F')).toBeInTheDocument();
});

test('uploading a document posts the file then refetches the list', async () => {
  setSession(OPS);
  const { container } = renderAt('documents');
  await waitFor(() => expect(screen.getByText('signed-contract.pdf')).toBeInTheDocument());

  const file = new File(['%PDF-1.4'], 'contract.pdf', { type: 'application/pdf' });
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });

  await waitFor(() => expect(adminHost360UploadDoc).toHaveBeenCalledTimes(1));
  expect(adminHost360UploadDoc.mock.calls[0][0]).toBe(HOST_ID);
  expect(adminHost360UploadDoc.mock.calls[0][1].name).toBe('contract.pdf');
  await waitFor(() => expect(adminHost360Documents).toHaveBeenCalledTimes(2)); // initial + refetch
});

test('deleting a document confirms first and refetches', async () => {
  setSession(OPS);
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderAt('documents');
  await waitFor(() => expect(screen.getByText('signed-contract.pdf')).toBeInTheDocument());

  fireEvent.click(screen.getByText('Delete'));

  await waitFor(() => expect(adminHost360DeleteDoc).toHaveBeenCalledWith(HOST_ID, 'd1'));
  expect(confirmSpy).toHaveBeenCalled();
  await waitFor(() => expect(adminHost360Documents).toHaveBeenCalledTimes(2));
  confirmSpy.mockRestore();
});

test('cancelling the delete confirm leaves the document alone', async () => {
  setSession(OPS);
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  renderAt('documents');
  await waitFor(() => expect(screen.getByText('signed-contract.pdf')).toBeInTheDocument());

  fireEvent.click(screen.getByText('Delete'));

  expect(adminHost360DeleteDoc).not.toHaveBeenCalled();
  confirmSpy.mockRestore();
});

// v3.81 — a kyc.view-only admin keeps KYC review, loses the paperwork.
test('a kyc-only admin sees the locked notice and no upload control', async () => {
  setSession(KYC_ONLY);
  adminHost360Documents.mockResolvedValue({ data: { kyc: docsPayload.kyc, documents: [], documents_locked: true } });
  const { container } = renderAt('documents');

  await waitFor(() => expect(screen.getByText('XXXXXX234F')).toBeInTheDocument()); // KYC still readable
  expect(screen.getByText(/don't have access to this host's uploaded documents/i)).toBeInTheDocument();
  expect(container.querySelector('input[type="file"]')).toBe(null);
  expect(screen.queryByText('signed-contract.pdf')).toBe(null);
});

test('an admin without documents.manage gets no upload or delete control', async () => {
  setSession(['users.view', 'kyc.view', 'documents.view']);
  const { container } = renderAt('documents');
  await waitFor(() => expect(screen.getByText('signed-contract.pdf')).toBeInTheDocument());

  expect(container.querySelector('input[type="file"]')).toBe(null);
  expect(screen.queryByText('Delete')).toBe(null);
  expect(screen.getByText('Download')).toBeInTheDocument(); // read-only access still works
});
