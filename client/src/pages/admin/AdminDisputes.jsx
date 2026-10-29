import { useState, useEffect, useCallback } from 'react';
import { adminGetDisputes, adminResolveDispute, adminReverseBookingPayout } from '../../services/api';
import toast from 'react-hot-toast';
import { PageHeader, Card, Btn, Badge, Skeleton } from '../../components/admin/ui';
import AdminEmptyState from '../../components/admin/AdminEmptyState';

const ICON = ['M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', 'M12 9v4', 'M12 17h.01'];
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const RAISED_TONE = { guest: 'warn', admin: 'info', razorpay: 'danger' };
const XFER_TONE = { reversed: 'danger', processed: 'ok', pending: 'warn', failed: 'danger' };
const TABS = ['open', 'resolved', 'all'];

const AdminDisputes = () => {
  const [tab, setTab] = useState('open');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await adminGetDisputes(tab); setRows(data || []); }
    catch { toast.error('Failed to load disputes'); }
    finally { setLoading(false); }
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const resolve = async (id) => {
    const resolution = window.prompt('Resolution note (what did you decide?)');
    if (!resolution) return;
    setBusy(id);
    try { await adminResolveDispute(id, resolution); toast.success('Resolved'); load(); }
    catch (e) { toast.error(e?.response?.data?.message || 'Failed'); }
    finally { setBusy(null); }
  };

  const reversePayout = async (bookingId) => {
    const reason = window.prompt('Reverse the host payout — reason?');
    if (reason == null) return;
    setBusy(bookingId);
    try { await adminReverseBookingPayout(bookingId, reason); toast.success('Payout reversed'); load(); }
    catch (e) { toast.error(e?.response?.data?.message || 'Failed'); }
    finally { setBusy(null); }
  };

  return (
    <div className="max-w-[1100px]">
      <PageHeader title="Disputes" subtitle="Review reported bookings, hold host payouts, and resolve." />

      <div className="flex gap-1.5 mb-5">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-[12.5px] font-medium capitalize transition-colors
              ${t === tab ? 'bg-gray-900 text-white' : 'adm-card adm-t3 hover:border-gray-300'}`}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : rows.length === 0 ? (
        <AdminEmptyState icon={ICON} iconBg="bg-red-50" iconColor="text-red-500"
          title={`No ${tab === 'all' ? '' : tab} disputes`} description="Reported bookings, admin holds, and Razorpay disputes appear here." />
      ) : (
        <div className="space-y-3">
          {rows.map((d) => {
            const b = d.bookings || {};
            const held = b.razorpay_transfer_id && b.transfer_status !== 'reversed';
            return (
              <Card key={d.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold adm-t1">{b.services?.title || 'Booking'}</span>
                      <Badge tone={RAISED_TONE[d.raised_by] || 'warn'}><span className="capitalize">{d.raised_by}</span></Badge>
                      {b.transfer_status && <Badge tone={XFER_TONE[b.transfer_status] || 'warn'}>payout: {b.transfer_status}</Badge>}
                      {d.status === 'resolved' && <Badge tone="ok">resolved</Badge>}
                    </div>
                    <p className="mt-1 text-sm adm-t2">{d.reason || '—'}</p>
                    <p className="mt-1 text-[12px] adm-t3">
                      Guest {b.guest_name || b.guest_email || '—'} · payout {inr(b.vendor_amount)} · session {fmt(b.scheduled_at)} · raised {fmt(d.created_at)}
                    </p>
                    {d.resolution && <p className="mt-2 text-[12.5px] adm-t2 bg-emerald-50 rounded-lg p-2">Resolution: {d.resolution}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    {held && (
                      <Btn size="sm" variant="outline" disabled={busy === b.id} className="!text-rose-600"
                        onClick={() => reversePayout(b.id)}>Reverse payout</Btn>
                    )}
                    {d.status === 'open' && (
                      <Btn size="sm" disabled={busy === d.id} onClick={() => resolve(d.id)}>Resolve</Btn>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminDisputes;
