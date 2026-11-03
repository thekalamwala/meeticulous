import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { adminGetPlatformReviews, adminModeratePlatformReview } from '../../services/api';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { PageHeader, Badge, Btn, Skeleton } from '../../components/admin/ui';

// Testimonials = reviews OF Meeticulous submitted at /submit-review (v3.185).
// A review reaches the Wall of Love / marketing only when it is Approved here AND
// its author ticked public consent. Edits by the author return it to Pending.
const ICON = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
const SHARE_URL = 'https://meeticulous.com/submit-review';

const TABS = [
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: '',         label: 'All' },
];
const TONE = { pending: 'warn', approved: 'ok', rejected: 'danger' };
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const AdminTestimonials = () => {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminGetPlatformReviews(status ? { status } : {});
      setRows(Array.isArray(data) ? data : []);
    } catch { toast.error('Failed to load testimonials'); }
    finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const moderate = async (r, next) => {
    setBusyId(r.id);
    try { await adminModeratePlatformReview(r.id, { status: next }); toast.success('Saved'); await load(); }
    catch (e) { toast.error(e?.response?.data?.message || 'Action failed'); }
    finally { setBusyId(null); }
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(SHARE_URL).then(() => toast.success('Link copied'), () => toast.error(SHARE_URL));
  };

  const tabs = (
    <div className="flex gap-1 adm-card rounded-xl p-1">
      {TABS.map(t => (
        <button key={t.key} onClick={() => setStatus(t.key)}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all
            ${status === t.key ? 'bg-[#960D32] text-white' : 'adm-t2 hover:text-gray-700'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="max-w-[1100px]">
      <PageHeader title="Testimonials" subtitle="Reviews of Meeticulous from signed-in hosts and guests" actions={tabs} />

      <div className="adm-card rounded-xl p-3 mb-4 flex flex-col sm:flex-row sm:items-center gap-2 justify-between text-[12.5px]">
        <span className="adm-t2">Share this link to collect reviews: <span className="font-mono">{SHARE_URL}</span></span>
        <Btn size="sm" variant="outline" onClick={copyLink}>Copy link</Btn>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : rows.length === 0 ? (
        <AdminEmptyState icon={ICON} iconBg="bg-yellow-50" iconColor="text-yellow-500"
          title="Nothing here yet"
          description="Reviews submitted at /submit-review land here for approval. Only approved reviews with public consent appear on the Wall of Love." />
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.id} className="adm-card rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="font-semibold adm-t2">{r.author?.name || 'Unknown'}</span>
                <span className="adm-t3">{r.author?.username ? `@${r.author.username}` : r.author?.phone || r.author?.email || ''}</span>
                <Badge tone="neutral"><span className="capitalize">{r.reviewer_role}</span></Badge>
                <Badge tone={TONE[r.status] || 'neutral'}><span className="capitalize">{r.status}</span></Badge>
                <Badge tone={r.consent_public ? 'ok' : 'neutral'}>{r.consent_public ? 'Public consent' : 'Private only'}</Badge>
                <span className="ml-auto adm-t3">{fmt(r.updated_at || r.created_at)}</span>
              </div>
              <p className="mt-2 text-amber-500" title={`${r.rating}/5`}>
                {'★'.repeat(r.rating)}<span className="adm-t3">{'★'.repeat(5 - r.rating)}</span>
              </p>
              {r.title && <p className="mt-1 font-semibold adm-t2">{r.title}</p>}
              <p className="mt-1 text-[13px] adm-t2 whitespace-pre-line">{r.body}</p>
              <div className="mt-3 flex gap-2">
                {r.status !== 'approved' && (
                  <Btn size="sm" disabled={busyId === r.id} onClick={() => moderate(r, 'approved')}>Approve</Btn>
                )}
                {r.status !== 'rejected' && (
                  <Btn size="sm" variant="outline" disabled={busyId === r.id} onClick={() => moderate(r, 'rejected')}>Reject</Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminTestimonials;
