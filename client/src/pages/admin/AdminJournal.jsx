import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  adminFinanceJournals, adminFinanceJournal, adminFinanceAccounts,
  adminFinanceAdjustment, adminFinanceReversal, adminFinanceBankTransfer, adminFinanceRefund,
} from '../../services/api';
import toast from 'react-hot-toast';
import { PageHeader, Btn, Skeleton } from '../../components/admin/ui';

// Journal browser — append-only double-entry record. Corrections happen ONLY
// through adjustment/reversal entries (the modal); nothing is ever edited.

const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n) || 0);
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—');
const SOURCES = ['ORDER_PAYMENT', 'SUBSCRIPTION_PAYMENT', 'PRODUCT_PAYMENT', 'REFUND', 'SETTLEMENT', 'BANK_TRANSFER', 'ADJUSTMENT', 'REVERSAL', 'BACKFILL', 'BACKFILL_SETTLEMENT'];

// Whose money each ledger account holds — mirrors the legend in
// server/services/ledger/journalTemplates.js and docs/ledger.md. Lets a reader
// see, per line, who receives it (Host / Meeticulous / Government / Razorpay)
// without knowing the chart of accounts.
const OWNER_BY_CODE = {
  '1000': 'Meeticulous', '1100': 'Meeticulous',
  '2000': 'Host', '2100': 'Government', '2200': 'Meeticulous',
  '2300': 'Government', '2400': 'Government',
  '4000': 'Meeticulous', '4100': 'Meeticulous', '4200': 'Meeticulous',
  '5000': 'Razorpay', '5100': 'Razorpay', '5200': 'Razorpay',
  '5300': 'Meeticulous', '5400': 'Meeticulous',
};
const ownerOf = (code) => OWNER_BY_CODE[code] || '—';

const emptyLine = () => ({ account_code: '', debit: '', credit: '' });

const AdminJournal = () => {
  const [journals, setJournals] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ source_type: '', from: '', to: '' });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);   // journal id → { entry, lines }
  const [lineCache, setLineCache] = useState({});
  const [modal, setModal] = useState(null);          // 'adjustment' | 'transfer' | null
  const [accounts, setAccounts] = useState([]);
  const [adjLines, setAdjLines] = useState([emptyLine(), emptyLine()]);
  const [adjDesc, setAdjDesc] = useState('');
  const [transfer, setTransfer] = useState({ amount: '', reference: '' });
  const [refund, setRefund] = useState({ booking_id: '', amount: '', reference: '', reverse_payout: true });
  const [saving, setSaving] = useState(false);
  const limit = 25;

  const fetchJournals = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page };
      if (filters.source_type) params.source_type = filters.source_type;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      const { data } = await adminFinanceJournals(params);
      setJournals(data.journals || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load journal');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchJournals(); }, [fetchJournals]);
  useEffect(() => { adminFinanceAccounts().then((r) => setAccounts(r.data.accounts || [])).catch(() => {}); }, []);

  const toggle = async (id) => {
    if (expanded === id) return setExpanded(null);
    setExpanded(id);
    if (!lineCache[id]) {
      try {
        const { data } = await adminFinanceJournal(id);
        setLineCache((c) => ({ ...c, [id]: data.lines || [] }));
      } catch { toast.error('Failed to load lines'); }
    }
  };

  const reverse = async (id) => {
    if (!window.confirm('Post a reversal entry mirroring this journal entry?')) return;
    try {
      await adminFinanceReversal({ journal_entry_id: id });
      toast.success('Reversal posted');
      fetchJournals();
    } catch (e) { toast.error(e.response?.data?.message || 'Reversal failed'); }
  };

  const submitAdjustment = async () => {
    setSaving(true);
    try {
      const lines = adjLines
        .filter((l) => l.account_code)
        .map((l) => ({ account_code: l.account_code, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }));
      await adminFinanceAdjustment({ description: adjDesc, lines });
      toast.success('Adjustment posted');
      setModal(null); setAdjLines([emptyLine(), emptyLine()]); setAdjDesc('');
      fetchJournals();
    } catch (e) { toast.error(e.response?.data?.message || 'Adjustment failed'); }
    finally { setSaving(false); }
  };

  const submitTransfer = async () => {
    setSaving(true);
    try {
      await adminFinanceBankTransfer({ amount: Number(transfer.amount), reference: transfer.reference });
      toast.success('Bank transfer recorded');
      setModal(null); setTransfer({ amount: '', reference: '' });
      fetchJournals();
    } catch (e) { toast.error(e.response?.data?.message || 'Transfer failed'); }
    finally { setSaving(false); }
  };

  const submitRefund = async () => {
    setSaving(true);
    try {
      const r = await adminFinanceRefund({
        booking_id: refund.booking_id.trim(),
        amount: Number(refund.amount),
        reference: refund.reference.trim(),
        reverse_payout: refund.reverse_payout,
      });
      toast.success(r.data?.transfer_reversed ? 'Refund recorded · host payout reversed' : 'Refund recorded');
      setModal(null); setRefund({ booking_id: '', amount: '', reference: '', reverse_payout: true });
      fetchJournals();
    } catch (e) { toast.error(e.response?.data?.message || 'Refund failed'); }
    finally { setSaving(false); }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const entryAmount = (id) => {
    const lines = lineCache[id];
    if (!lines) return null;
    return lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  };

  // Client-side balance gate for the adjustment modal — catch an unbalanced or
  // single-sided entry before the server 400 round-trip.
  const adjFilled = adjLines.filter((l) => l.account_code);
  const adjDebit = Math.round(adjFilled.reduce((s, l) => s + (Number(l.debit) || 0), 0) * 100) / 100;
  const adjCredit = Math.round(adjFilled.reduce((s, l) => s + (Number(l.credit) || 0), 0) * 100) / 100;
  const adjBalanced = adjFilled.length >= 2 && adjDebit > 0 && adjDebit === adjCredit;

  return (
    <div>
      <PageHeader title="Journal" subtitle={`Append-only double-entry record. ${total} entr${total === 1 ? 'y' : 'ies'}.`}
        actions={<>
          <Btn variant="outline" size="sm" onClick={() => setModal('refund')}>Record refund</Btn>
          <Btn variant="outline" size="sm" onClick={() => setModal('transfer')}>Record bank transfer</Btn>
          <Btn size="sm" onClick={() => setModal('adjustment')}>New adjustment</Btn>
        </>} />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-[11px] font-medium adm-t3 mb-1">Source</label>
          <select className="fb-input text-sm" value={filters.source_type}
            onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, source_type: e.target.value })); }}>
            <option value="">All sources</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium adm-t3 mb-1">From</label>
          <input type="date" className="fb-input text-sm" value={filters.from}
            onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, from: e.target.value })); }} />
        </div>
        <div>
          <label className="block text-[11px] font-medium adm-t3 mb-1">To</label>
          <input type="date" className="fb-input text-sm" value={filters.to}
            onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, to: e.target.value })); }} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : journals.length === 0 ? (
        <div className="adm-card rounded-2xl py-16 text-center adm-t3">No journal entries match these filters.</div>
      ) : (
        <div className="adm-card rounded-2xl overflow-hidden">
          <table className="adm-table w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide adm-t3 border-b adm-border">
                <th className="px-4 py-3 font-semibold">Entry</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Description</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {journals.map((j) => (
                <Fragment key={j.id}>
                  <tr className="border-b adm-border last:border-0 adm-hoverable cursor-pointer" onClick={() => toggle(j.id)}>
                    <td className="px-4 py-3 font-mono text-[12px] font-semibold adm-t2">{j.journal_number}</td>
                    <td className="px-4 py-3 text-[12px] adm-t3 whitespace-nowrap">{fmt(j.journal_date)}</td>
                    <td className="px-4 py-3"><span className="text-[11px] font-mono px-2 py-1 rounded adm-chip adm-t2">{j.source_type}</span></td>
                    <td className="px-4 py-3 hidden md:table-cell text-[12px] adm-t3 truncate max-w-[280px]">{j.description || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-[11px] adm-t3 underline min-h-[44px] px-2" onClick={(e) => { e.stopPropagation(); reverse(j.id); }}>Reverse</button>
                    </td>
                  </tr>
                  {expanded === j.id && (
                    <tr className="bg-[var(--adm-hover)] border-b adm-border">
                      <td colSpan={5} className="px-6 py-3">
                        {!lineCache[j.id] ? (
                          <Skeleton className="h-8" />
                        ) : (
                          <table className="w-full text-[12px]">
                            <thead>
                              <tr className="text-left text-[10px] uppercase tracking-wide adm-t3">
                                <th className="py-1 pr-3 font-semibold">Account</th>
                                <th className="py-1 pr-3 font-semibold" />
                                <th className="py-1 pr-3 font-semibold">Who gets it</th>
                                <th className="py-1 pr-3 font-semibold text-right">Debit</th>
                                <th className="py-1 font-semibold text-right">Credit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lineCache[j.id].map((l) => (
                                <tr key={l.id}>
                                  <td className="py-1 pr-3 font-mono adm-t3">{l.chart_of_accounts?.code}</td>
                                  <td className="py-1 pr-3 adm-t2">{l.chart_of_accounts?.name}</td>
                                  <td className="py-1 pr-3">
                                    <span className="text-[11px] px-2 py-0.5 rounded adm-chip adm-t2">{ownerOf(l.chart_of_accounts?.code)}</span>
                                  </td>
                                  <td className="py-1 pr-3 text-right tabular-nums">{Number(l.debit) > 0 ? inr(l.debit) : ''}</td>
                                  <td className="py-1 text-right tabular-nums adm-t3">{Number(l.credit) > 0 ? inr(l.credit) : ''}</td>
                                </tr>
                              ))}
                              <tr className="border-t adm-border">
                                <td colSpan={3} className="py-1 pr-3 adm-t3">Entry total</td>
                                <td className="py-1 pr-3 text-right tabular-nums font-semibold">{inr(entryAmount(j.id))}</td>
                                <td className="py-1 text-right tabular-nums font-semibold adm-t3">{inr(entryAmount(j.id))}</td>
                              </tr>
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Btn variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Btn>
          <span className="text-[12px] adm-t3">Page {page} of {totalPages}</span>
          <Btn variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Btn>
        </div>
      )}

      {/* Manual-entry modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="adm-card rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
            {modal === 'refund' ? (
              <>
                <h2 className="font-bold adm-t1 mb-1">Record refund</h2>
                <p className="text-[12px] adm-t3 mb-4">
                  For a refund issued in the Razorpay dashboard. Posts the balanced REFUND entry
                  from the booking snapshot (host price → Vendor Payables/TDS/TCS/commission,
                  fee only on a full refund, non-recoverable gateway → Refund Losses).
                </p>
                <label className="block text-[11px] font-medium adm-t3 mb-1">Booking ID</label>
                <input type="text" className="fb-input text-sm w-full mb-3 font-mono" value={refund.booking_id} placeholder="booking uuid"
                  onChange={(e) => setRefund((r) => ({ ...r, booking_id: e.target.value }))} />
                <label className="block text-[11px] font-medium adm-t3 mb-1">Refund amount (₹)</label>
                <input type="number" min="0.01" step="0.01" className="fb-input text-sm w-full mb-3 tabular-nums" value={refund.amount}
                  onChange={(e) => setRefund((r) => ({ ...r, amount: e.target.value }))} />
                <label className="block text-[11px] font-medium adm-t3 mb-1">Razorpay refund id / reference <span className="adm-t3">(optional, dedupes)</span></label>
                <input type="text" className="fb-input text-sm w-full mb-3" value={refund.reference} placeholder="rfnd_..."
                  onChange={(e) => setRefund((r) => ({ ...r, reference: e.target.value }))} />
                <label className="flex items-center gap-2 text-[12px] adm-t2 mb-5 cursor-pointer">
                  <input type="checkbox" checked={refund.reverse_payout}
                    onChange={(e) => setRefund((r) => ({ ...r, reverse_payout: e.target.checked }))} />
                  Also reverse the held host payout (recommended)
                </label>
                <div className="flex justify-end gap-2">
                  <Btn variant="ghost" size="sm" onClick={() => setModal(null)}>Cancel</Btn>
                  <Btn size="sm" disabled={saving || !refund.booking_id.trim() || !(Number(refund.amount) > 0)} onClick={submitRefund}>
                    {saving ? 'Recording…' : 'Record refund'}
                  </Btn>
                </div>
              </>
            ) : modal === 'transfer' ? (
              <>
                <h2 className="font-bold adm-t1 mb-1">Record bank transfer</h2>
                <p className="text-[12px] adm-t3 mb-4">Razorpay settlement received in the bank account. DR Bank / CR Razorpay Receivable.</p>
                <label className="block text-[11px] font-medium adm-t3 mb-1">Amount (₹)</label>
                <input type="number" min="0.01" step="0.01" className="fb-input text-sm w-full mb-3" value={transfer.amount}
                  onChange={(e) => setTransfer((t) => ({ ...t, amount: e.target.value }))} />
                <label className="block text-[11px] font-medium adm-t3 mb-1">Settlement reference</label>
                <input type="text" className="fb-input text-sm w-full mb-5" value={transfer.reference} placeholder="setl_..."
                  onChange={(e) => setTransfer((t) => ({ ...t, reference: e.target.value }))} />
                <div className="flex justify-end gap-2">
                  <Btn variant="ghost" size="sm" onClick={() => setModal(null)}>Cancel</Btn>
                  <Btn size="sm" disabled={saving || !(Number(transfer.amount) > 0)} onClick={submitTransfer}>
                    {saving ? 'Posting…' : 'Post entry'}
                  </Btn>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-bold adm-t1 mb-1">New adjustment entry</h2>
                <p className="text-[12px] adm-t3 mb-4">Debits must equal credits. Posted entries are permanent.</p>
                <label className="block text-[11px] font-medium adm-t3 mb-1">Description</label>
                <input type="text" className="fb-input text-sm w-full mb-3" value={adjDesc} onChange={(e) => setAdjDesc(e.target.value)} />
                {adjLines.map((l, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <select className="fb-input text-sm flex-1" value={l.account_code}
                      onChange={(e) => setAdjLines((ls) => ls.map((x, j) => (j === i ? { ...x, account_code: e.target.value } : x)))}>
                      <option value="">Account…</option>
                      {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                    </select>
                    <input type="number" min="0" step="0.01" placeholder="Debit" className="fb-input text-sm w-24 tabular-nums" value={l.debit}
                      onChange={(e) => setAdjLines((ls) => ls.map((x, j) => (j === i ? { ...x, debit: e.target.value, credit: '' } : x)))} />
                    <input type="number" min="0" step="0.01" placeholder="Credit" className="fb-input text-sm w-24 tabular-nums" value={l.credit}
                      onChange={(e) => setAdjLines((ls) => ls.map((x, j) => (j === i ? { ...x, credit: e.target.value, debit: '' } : x)))} />
                  </div>
                ))}
                <button className="text-[11px] adm-t3 underline mb-4" onClick={() => setAdjLines((ls) => [...ls, emptyLine()])}>+ Add line</button>
                <div className={`text-[12px] mb-4 tabular-nums ${adjBalanced ? 'text-green-600' : 'adm-t3'}`}>
                  Debits {inr(adjDebit)} · Credits {inr(adjCredit)}
                  {!adjBalanced && <span className="ml-1 adm-t3">— must balance (≥2 lines, debits = credits)</span>}
                </div>
                <div className="flex justify-end gap-2">
                  <Btn variant="ghost" size="sm" onClick={() => setModal(null)}>Cancel</Btn>
                  <Btn size="sm" disabled={saving || !adjBalanced} onClick={submitAdjustment}>
                    {saving ? 'Posting…' : 'Post entry'}
                  </Btn>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminJournal;
