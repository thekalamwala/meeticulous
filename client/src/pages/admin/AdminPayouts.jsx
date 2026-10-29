import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminGetPayouts, adminApprovePayout, adminRejectPayout, adminMarkPayoutPaid, adminReleasePayoutRoute, adminGetPayoutClearing, adminRunPayoutReconcile } from '../../services/api';
import toast from 'react-hot-toast';
import { PageHeader, Card, Btn, Badge, Skeleton } from '../../components/admin/ui';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const STATUS_TONE = {
  pending: 'warn',
  approved: 'info',
  paid: 'ok',
  rejected: 'danger',
};
// 'clearing' is a read-only view of funds not yet in the payout queue (maturing
// or below the withdrawal minimum) — it is not a payout_requests status.
const TABS = ['all', 'pending', 'approved', 'paid', 'rejected', 'clearing'];

const Modal = ({ title, label, placeholder, confirmText, onClose, onConfirm }) => {
  const [val, setVal] = useState('');
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative adm-card w-full max-w-sm rounded-2xl shadow-2xl p-5">
        <h3 className="text-sm font-bold adm-t1 mb-3">{title}</h3>
        <label className="block mb-3">
          <span className="text-[12px] adm-t3">{label}</span>
          <input autoFocus value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder}
            className="mt-1.5 w-full border adm-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0079C1]/30 focus:border-[#0079C1]" />
        </label>
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" disabled={!val.trim()} onClick={() => onConfirm(val.trim())}>{confirmText}</Btn>
        </div>
      </div>
    </div>
  );
};

const AdminPayouts = () => {
  // Deep-link support: ops dashboard "Pending payouts" card links with ?status=pending.
  const [searchParams] = useSearchParams();
  const initTab = TABS.includes(searchParams.get('status')) ? searchParams.get('status') : 'pending';
  const [tab, setTab] = useState(initTab);
  const [rows, setRows] = useState([]);
  const [clearing, setClearing] = useState({ threshold: 1, hosts: [] });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { kind: 'reject'|'pay', id }
  const [reconciling, setReconciling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'clearing') {
        const { data } = await adminGetPayoutClearing();
        setClearing(data || { threshold: 1, hosts: [] });
      } else {
        const { data } = await adminGetPayouts(tab);
        setRows(data || []);
      }
    }
    catch { toast.error('Failed to load payouts'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, id, ...args) => {
    try { await fn(id, ...args); toast.success('Done'); load(); }
    catch (e) { toast.error(e?.response?.data?.message || 'Action failed'); }
  };

  // Force a payout-reconciler run now — the cron is every 15 min and pauses when
  // free-tier Render sleeps, so this lets an admin sync/settle without waiting.
  const runReconcile = async () => {
    setReconciling(true);
    try {
      const { data } = await adminRunPayoutReconcile();
      if (data?.skipped === 'off') toast('Reconciler is off (set mode to observe/live).');
      else toast.success(`Reconcile (${data.mode}): created ${data.created || 0}, finalized ${data.finalized || 0}, released ${data.released || 0}`);
      load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Reconcile failed'); }
    finally { setReconciling(false); }
  };

  return (
    <div className="max-w-[1100px]">
      <PageHeader title="Payouts" subtitle="Approve, reject, and mark host payout requests as paid." />

      <div className="flex items-center gap-1.5 mb-5">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-[12.5px] font-medium capitalize transition-colors
              ${t === tab ? 'bg-gray-900 text-white' : 'adm-card adm-t3 hover:border-gray-300'}`}>
            {t}
          </button>
        ))}
        <Btn variant="outline" size="sm" className="ml-auto" disabled={reconciling} onClick={runReconcile}
          title="Run the payout reconciler now (create/finalize transfers, sync bank-settlement status)">
          {reconciling ? 'Running…' : 'Run reconcile'}
        </Btn>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : tab === 'clearing' ? (
        <div>
          <p className="text-[12.5px] adm-t3 mb-3 leading-relaxed">
            Funds owed to hosts that are <strong className="adm-t2">not yet in the payout queue</strong>.
            <span className="mx-1">·</span><span className="text-amber-600 font-medium">In Clearing</span> and
            <span className="text-blue-600 font-medium"> Pending Completion</span> mature over the settlement window (time-based).
            A host can request a payout once <span className="text-emerald-600 font-medium">Available</span> reaches the
            {' '}₹{clearing.threshold} minimum.
          </p>
          {clearing.hosts.length === 0 ? (
            <div className="adm-card rounded-2xl py-16 text-center text-[13px] adm-t3">No host funds in clearing right now.</div>
          ) : (
            <div className="adm-card rounded-xl overflow-x-auto">
              <table className="adm-table w-full border-collapse text-[13px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide adm-t3 text-left">
                    <th className="px-4 py-2.5 font-semibold">Host</th>
                    <th className="px-4 py-2.5 font-semibold text-right">In Clearing</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Pending Completion</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Available</th>
                    <th className="px-4 py-2.5 font-semibold">Eligibility</th>
                  </tr>
                </thead>
                <tbody>
                  {clearing.hosts.map(h => (
                    <tr key={h.host_id} className="border-t adm-border">
                      <td className="px-4 py-3">
                        <p className="font-medium adm-t2">{h.name || '—'}</p>
                        {h.username && <p className="text-[11.5px] adm-t3">@{h.username}</p>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-600 font-medium">{inr(h.clearing)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-blue-600">{inr(h.pendingCompletion)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold adm-t1">{inr(h.available)}</td>
                      <td className="px-4 py-3">
                        {h.eligible
                          ? <Badge tone="ok">Eligible</Badge>
                          : <Badge tone="warn">Below ₹{clearing.threshold}</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : rows.length === 0 ? (
        <div className="adm-card rounded-2xl py-16 text-center text-[13px] adm-t3">No {tab === 'all' ? '' : tab} payout requests.</div>
      ) : (
        <div className="adm-card rounded-xl overflow-x-auto">
          <table className="adm-table w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide adm-t3 text-left">
                <th className="px-4 py-2.5 font-semibold">Host</th>
                <th className="px-4 py-2.5 font-semibold text-right">Amount</th>
                <th className="px-4 py-2.5 font-semibold">Requested</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t adm-border">
                  <td className="px-4 py-3">
                    <p className="font-medium adm-t2">{r.profiles?.name || '—'}</p>
                    {r.profiles?.username && <p className="text-[11.5px] adm-t3">@{r.profiles.username}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold adm-t1 tabular-nums">{inr(r.amount)}</td>
                  <td className="px-4 py-3 adm-t2 tabular-nums">{fmt(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[r.status] || 'warn'}><span className="capitalize">{r.status}</span></Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      {r.status === 'pending' && (
                        <>
                          <Btn size="sm" onClick={() => act(adminApprovePayout, r.id)} className="!bg-emerald-600 hover:!bg-emerald-700">Approve</Btn>
                          <Btn variant="outline" size="sm" onClick={() => setModal({ kind: 'reject', id: r.id })} className="!text-rose-600">Reject</Btn>
                        </>
                      )}
                      {r.status === 'approved' && (
                        <>
                          <Btn size="sm" onClick={() => act(adminReleasePayoutRoute, r.id)}>Pay via Route</Btn>
                          <Btn variant="outline" size="sm" onClick={() => setModal({ kind: 'pay', id: r.id })}>Mark Paid</Btn>
                        </>
                      )}
                      {r.status === 'paid' && (
                        <span className="text-[11.5px] adm-t3 font-mono" title={r.transfer_status ? `Route transfer: ${r.transfer_status}` : undefined}>
                          {r.payment_reference || '—'}
                        </span>
                      )}
                      {r.status === 'rejected' && <span className="text-[11.5px] adm-t3 truncate max-w-[200px]" title={r.admin_note}>{r.admin_note || '—'}</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.kind === 'reject' && (
        <Modal title="Reject payout request" label="Reason (shown to host)" placeholder="e.g. Bank details missing" confirmText="Reject"
          onClose={() => setModal(null)}
          onConfirm={(reason) => { setModal(null); act(adminRejectPayout, modal.id, reason); }} />
      )}
      {modal?.kind === 'pay' && (
        <Modal title="Mark payout as paid" label="Payment reference (UTR / txn id)" placeholder="e.g. UTR1234567890" confirmText="Mark Paid"
          onClose={() => setModal(null)}
          onConfirm={(ref) => { setModal(null); act(adminMarkPayoutPaid, modal.id, ref); }} />
      )}
    </div>
  );
};

export default AdminPayouts;
