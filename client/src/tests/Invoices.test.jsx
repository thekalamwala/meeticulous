/**
 * Invoices — characterisation tests.
 *
 * The other console page with no coverage that nobody has edited since 3 Nov,
 * and it is a GST surface: these are tax documents a host downloads and files.
 * A silent change to what is listed, or to the link that fetches a PDF, is the
 * kind of thing discovered at the end of a quarter.
 *
 * Asserts what the page does TODAY, so a later change to it is a decision.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../services/api', () => ({
  getMyInvoices: vi.fn(),
  invoiceUrl: vi.fn((id, token) => `/invoices/${id}?t=${token}`),
}));

import { getMyInvoices, invoiceUrl } from '../services/api';
import Invoices from '../pages/Invoices';

const rows = [
  { id: 'i1', invoice_number: 'MT-SUB-00318', source_type: 'subscription', issued_at: '2026-11-05T00:00:00Z', total: 1178.82, access_token: 'tok-a' },
  { id: 'i2', invoice_number: 'MT-BKG-02241', source_type: 'booking', issued_at: '2026-10-30T00:00:00Z', total: 2832, access_token: 'tok-b' },
];

beforeEach(() => {
  vi.clearAllMocks();
  getMyInvoices.mockResolvedValue({ data: rows });
});

it('lists every invoice by its number', async () => {
  render(<Invoices />);
  // The number is how a host finds a document in their own records; it must be
  // on the page verbatim, not abbreviated.
  await waitFor(() => expect(screen.getByText('MT-SUB-00318')).toBeInTheDocument());
  expect(screen.getByText('MT-BKG-02241')).toBeInTheDocument();
});

it('tells a plan invoice apart from a booking invoice', async () => {
  // They are different tax documents with different counterparties. A host
  // reconciling a quarter needs to see which is which without opening them.
  render(<Invoices />);
  await waitFor(() => expect(screen.getByText('Plan')).toBeInTheDocument());
  expect(screen.getByText('Booking')).toBeInTheDocument();
});

it('shows paise, because a GST total is not a round number', async () => {
  render(<Invoices />);
  await waitFor(() => expect(screen.getByText(/1,178\.82/)).toBeInTheDocument());
});

it('builds each download link with that invoice’s own access token', async () => {
  // The token is what authorises the PDF. Crossing them would hand a host the
  // wrong document, or none.
  render(<Invoices />);
  await waitFor(() => expect(invoiceUrl).toHaveBeenCalledWith('i1', 'tok-a'));
  expect(invoiceUrl).toHaveBeenCalledWith('i2', 'tok-b');

  const links = screen.getAllByRole('link', { name: /download/i });
  expect(links[0]).toHaveAttribute('href', '/invoices/i1?t=tok-a');
  // Opens in a new tab, and rel is set — a target="_blank" without it is a
  // tabnabbing hole.
  expect(links[0]).toHaveAttribute('target', '_blank');
  expect(links[0]).toHaveAttribute('rel', 'noreferrer');
});

it('says there are none rather than showing an empty frame', async () => {
  getMyInvoices.mockResolvedValue({ data: [] });
  render(<Invoices />);
  await waitFor(() => expect(screen.getByText(/no invoices/i)).toBeInTheDocument());
});

it('offers a retry when the list fails to load', async () => {
  getMyInvoices.mockRejectedValue(new Error('500'));
  render(<Invoices />);
  // getAllBy: ErrorState renders a title and a message, both matching.
  await waitFor(() => expect(screen.getAllByText(/something went wrong|couldn’t load/i).length).toBeGreaterThan(0));
});

it('survives an invoice with no issue date', async () => {
  // Defended in fmtDate, so assert it stays defended: a missing date must not
  // take the whole list down.
  getMyInvoices.mockResolvedValue({ data: [{ ...rows[0], issued_at: null }] });
  render(<Invoices />);
  await waitFor(() => expect(screen.getByText('MT-SUB-00318')).toBeInTheDocument());
});
