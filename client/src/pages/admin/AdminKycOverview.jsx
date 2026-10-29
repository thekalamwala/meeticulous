import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, StatCard, Card, Table, Btn, Badge } from '../../components/admin/ui';
import { adminKycStats, adminListKyc } from '../../services/api';
import { KycDetail } from './AdminKYC';

const TONE = { pending: 'warn', approved: 'ok', rejected: 'danger' };
const LABEL = { pending: 'Pending', approved: 'Verified', rejected: 'Rejected' };
const SEEN_KEY = 'kyc_admin_seen';

const fmtDur = (ms) => {
  if (ms == null) return '—';
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
};
const fmtAgo = (iso) => {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return `${m}m ago`;
};

export default function AdminKycOverview() {
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(() => Number(localStorage.getItem(SEEN_KEY) || 0));

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminKycStats().then((r) => r.data).catch(() => null),
      adminListKyc('pending').then((r) => r.data).catch(() => []),
    ]).then(([s, p]) => { setStats(s); setPending(p || []); }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const c = stats?.counts || {};
  const t = stats?.throughput || {};

  // In-page notification feed: pending arrivals + recent decisions, newest first.
  const events = useMemo(() => {
    const fromPending = (pending || []).map((r) => ({ id: r.id, full_name: r.full_name, status: 'pending', at: r.created_at, kind: 'New submission' }));
    const fromRecent = (stats?.recent || []).map((r) => ({ id: r.id, full_name: r.full_name, status: r.status, at: r.reviewed_at, kind: r.status === 'approved' ? 'Verified' : 'Rejected' }));
    return [...fromPending, ...fromRecent].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12);
  }, [pending, stats]);
  const unread = events.filter((e) => new Date(e.at).getTime() > seenAt).length;

  const openBell = () => {
    setBellOpen((v) => !v);
    if (!bellOpen) { const now = Date.now(); localStorage.setItem(SEEN_KEY, String(now)); setSeenAt(now); }
  };

  const queue = useMemo(
    () => [...(pending || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [pending]
  );

  return (
    <div>
      <PageHeader
        title="KYC Operations"
        subtitle="Identity verification command centre"
        actions={
          <div className="relative">
            <Btn variant="outline" onClick={openBell}>
              Notifications{unread > 0 && <span className="ml-1 rounded-full bg-[#2E1065] px-1.5 text-[11px] text-white">{unread}</span>}
            </Btn>
            {bellOpen && (
              <div className="adm-card absolute right-0 z-40 mt-2 max-h-96 w-80 overflow-y-auto rounded-2xl p-2 shadow-lg">
                {events.length === 0 ? (
                  <p className="p-4 text-center text-sm adm-t3">No KYC activity yet.</p>
                ) : events.map((e, i) => (
                  <button key={e.id + i} onClick={() => { setOpenId(e.id); setBellOpen(false); }}
                    className="adm-hoverable flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left">
                    <Badge tone={TONE[e.status]}>{e.kind}</Badge>
                    <span className="flex-1 truncate text-[13px] adm-t2">{e.full_name || '—'}</span>
                    <span className="text-[11px] adm-t3">{fmtAgo(e.at)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />

      {/* Stat cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pending"  value={loading ? '—' : (c.pending || 0)}  icon="clock"       iconColor="bg-amber-500"  to="/admin/kyc/pending" />
        <StatCard label="Verified" value={loading ? '—' : (c.approved || 0)} icon="checkCircle" iconColor="bg-green-500"  to="/admin/kyc/approved" />
        <StatCard label="Rejected" value={loading ? '—' : (c.rejected || 0)} icon="x"           iconColor="bg-red-500"    to="/admin/kyc/rejected" />
        <StatCard label="Total"    value={loading ? '—' : (c.total || 0)}    icon="users"       iconColor="bg-gray-500"   sub={`${t.todayDecisions || 0} decided today`} to="/admin/kyc/pending" />
      </div>

      {/* Throughput / SLA */}
      <Card className="mb-4 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        {[
          ['Avg time to decision', fmtDur(t.avgDecisionMs)],
          ['Oldest pending', fmtDur(t.oldestPendingAgeMs)],
          ['Approval rate', t.approvalRate == null ? '—' : `${t.approvalRate}%`],
          ['Decisions today', t.todayDecisions ?? 0],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-[11px] font-medium uppercase tracking-wide adm-t3">{k}</p>
            <p className="mt-0.5 text-lg font-bold adm-t1">{loading ? '—' : v}</p>
          </div>
        ))}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Action queue — oldest pending first */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold adm-t1">Action queue</h3>
            <Link to="/admin/kyc/pending" className="text-xs text-[#2E1065] hover:underline">View all</Link>
          </div>
          <Table
            columns={[
              { key: 'full_name', label: 'Host' },
              { key: 'created_at', label: 'Waiting', render: (r) => fmtAgo(r.created_at) },
              { key: 'act', label: '', className: 'text-right', render: (r) => <Btn size="sm" onClick={() => setOpenId(r.id)}>Review</Btn> },
            ]}
            rows={queue.slice(0, 6)}
            rowKey={(r) => r.id}
            empty={<p className="p-6 text-center text-sm adm-t3">Queue clear — no pending submissions. 🎉</p>}
          />
        </div>

        {/* Recent activity */}
        <div>
          <h3 className="mb-2 text-sm font-semibold adm-t1">Recent activity</h3>
          <Table
            columns={[
              { key: 'full_name', label: 'Host' },
              { key: 'status', label: 'Result', render: (r) => <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge> },
              { key: 'reviewed_at', label: 'When', className: 'text-right', render: (r) => fmtAgo(r.reviewed_at) },
            ]}
            rows={stats?.recent || []}
            rowKey={(r) => r.id}
            onRowClick={(r) => setOpenId(r.id)}
            empty={<p className="p-6 text-center text-sm adm-t3">No decisions yet.</p>}
          />
        </div>
      </div>

      {openId && <KycDetail id={openId} onClose={() => setOpenId(null)} onDecided={() => { setOpenId(null); load(); }} />}
    </div>
  );
}
