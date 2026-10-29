import { useState, useEffect, useCallback } from 'react';
import { adminFinanceAccounts, adminFinanceLedger } from '../../services/api';
import toast from 'react-hot-toast';
import { PageHeader, Btn, Skeleton } from '../../components/admin/ui';

// Per-account ledger with running balance — the auditable account history.

const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n) || 0);
const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const AdminLedger = () => {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const limit = 25;

  useEffect(() => {
    adminFinanceAccounts()
      .then((r) => {
        const list = r.data.accounts || [];
        setAccounts(list);
        if (list.length && !accountId) setAccountId(list[0].id);
      })
      .catch((e) => toast.error(e.response?.data?.message || 'Failed to load accounts'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEntries = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const { data } = await adminFinanceLedger(accountId, { page });
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }, [accountId, page]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const selected = accounts.find((a) => a.id === accountId);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <PageHeader title="Ledger" subtitle="Per-account entries with running balance. Written only by the posting engine." />

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-[11px] font-medium adm-t3 mb-1">Account</label>
          <select className="fb-input text-sm min-w-[280px]" value={accountId}
            onChange={(e) => { setPage(1); setAccountId(e.target.value); }}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.type})</option>
            ))}
          </select>
        </div>
        {selected && (
          <p className="text-sm adm-t2 pb-2">
            Balance: <span className="font-bold tabular-nums">{inr(selected.account_balances?.[0]?.balance ?? selected.account_balances?.balance ?? 0)}</span>
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : entries.length === 0 ? (
        <div className="adm-card rounded-2xl py-16 text-center adm-t3">No ledger entries for this account yet.</div>
      ) : (
        <div className="adm-card rounded-2xl overflow-hidden">
          <table className="adm-table w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide adm-t3 border-b adm-border">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Journal</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Description</th>
                <th className="px-4 py-3 font-semibold text-right">Debit</th>
                <th className="px-4 py-3 font-semibold text-right">Credit</th>
                <th className="px-4 py-3 font-semibold text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b adm-border last:border-0 adm-hoverable">
                  <td className="px-4 py-3 text-[12px] adm-t3 whitespace-nowrap">{fmt(e.created_at)}</td>
                  <td className="px-4 py-3 font-mono text-[12px] adm-t2">{e.journal_entries?.journal_number}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-[12px] adm-t3 truncate max-w-[240px]">{e.journal_entries?.description || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{Number(e.debit) > 0 ? inr(e.debit) : ''}</td>
                  <td className="px-4 py-3 text-right tabular-nums adm-t3">{Number(e.credit) > 0 ? inr(e.credit) : ''}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{inr(e.balance_after_account)}</td>
                </tr>
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
    </div>
  );
};

export default AdminLedger;
