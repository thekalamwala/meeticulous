import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import Ic from '../../components/admin/Ic';
import { IC } from '../../components/admin/adminNav';
import { PageHeader, Card, Btn, Badge } from '../../components/admin/ui';
import {
  getReservedSlugs, createReservedSlug, releaseReservedSlug, checkReservedSlug,
} from '../../services/api';

const fmtDate = (s) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};

// Human-friendly explanation for the /check reason codes.
const REASON_LABEL = {
  ok: 'available',
  format: 'invalid format',
  reserved_route: 'reserved route',
  reserved_admin: 'reserved (admin)',
  taken: 'already taken',
};

const emptyForm = { slug: '', kind: 'admin', reason: '', is_prefix: false, premium: false };

const AdminReservedSlugs = () => {
  const [reservations, setReservations] = useState([]);
  const [systemCategories, setSystemCategories] = useState({});
  const [migrationPending, setMigrationPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Check-a-name tool
  const [checkSlug, setCheckSlug] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  // Create form
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  // System (code) reservations — collapsible, collapsed by default.
  const [showSystem, setShowSystem] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    getReservedSlugs()
      .then(({ data }) => {
        setReservations(Array.isArray(data?.reservations) ? data.reservations : []);
        setSystemCategories(data?.systemCategories || {});
        setMigrationPending(!!data?.migrationPending);
      })
      .catch(() => { setError(true); toast.error('Failed to load reserved slugs'); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const runCheck = async (e) => {
    e?.preventDefault();
    const slug = checkSlug.trim();
    if (!slug) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const { data } = await checkReservedSlug(slug);
      setCheckResult(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check failed');
    } finally {
      setChecking(false);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    const slug = form.slug.trim();
    if (!slug) return toast.error('Enter a slug to reserve');
    setCreating(true);
    try {
      await createReservedSlug({
        slug,
        kind: form.kind,
        reason: form.reason.trim() || null,
        is_prefix: form.is_prefix,
        premium: form.premium,
      });
      toast.success(`"${slug}" reserved`);
      setForm(emptyForm);
      load();
    } catch (err) {
      // 409 already reserved, 503 migration pending — surface the server message.
      toast.error(err.response?.data?.message || 'Could not reserve slug');
    } finally {
      setCreating(false);
    }
  };

  const release = async (r) => {
    if (!window.confirm(`Release the reservation for "${r.slug}"? It will become claimable again.`)) return;
    try {
      await releaseReservedSlug(r.id);
      toast.success('Reservation released');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Release failed');
    }
  };

  const categoryEntries = Object.entries(systemCategories || {})
    .filter(([, list]) => Array.isArray(list) && list.length > 0);

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Reserved Slugs"
        subtitle="Reserve usernames / profile slugs so they can never be claimed by a host. Code-protected routes are listed below and cannot be changed here."
      />

      {migrationPending && (
        <div className="mb-5 flex items-start gap-2 border border-amber-200 bg-amber-50 rounded px-4 py-3 text-sm text-amber-800">
          <Ic d={IC.alert} size={16} className="mt-0.5 shrink-0" />
          <span>Run migration <code className="font-mono">v3.33_reserved_slugs.sql</code> to enable reservations.</span>
        </div>
      )}

      {/* ── Check-a-name tool ──────────────────────────────────── */}
      <Card className="p-4 mb-6">
        <h2 className="text-sm font-bold adm-t2 mb-3">Check a name</h2>
        <form onSubmit={runCheck} className="flex flex-wrap gap-2">
          <input className="fb-input flex-1 min-w-[200px]" placeholder="e.g. admin, my-name"
            value={checkSlug} onChange={(e) => { setCheckSlug(e.target.value); setCheckResult(null); }} />
          <Btn type="submit" size="sm" disabled={checking || !checkSlug.trim()} className="shrink-0">
            <Ic d={IC.search} size={16} strokeWidth={2.5} /> {checking ? 'Checking…' : 'Check'}
          </Btn>
        </form>
        {checkResult && (
          <div className="mt-3 text-sm">
            {checkResult.available ? (
              <div className="inline-flex items-center gap-2 rounded border border-green-300 bg-green-50 text-green-700 px-3 py-1.5">
                <span className="font-semibold">Available</span>
                {checkResult.normalized && (
                  <span className="text-green-600">normalizes to <code className="font-mono">{checkResult.normalized}</code></span>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded border border-red-300 bg-red-50 text-red-700 px-3 py-1.5">
                <span className="font-semibold">Blocked:</span>
                <span>{REASON_LABEL[checkResult.reason] || checkResult.reason}</span>
                {checkResult.normalized && (
                  <span className="text-red-600">— normalizes to <code className="font-mono">{checkResult.normalized}</code></span>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Create reservation ─────────────────────────────────── */}
      <Card className="p-4 mb-6">
        <h2 className="text-sm font-bold adm-t2 mb-3">Reserve a slug</h2>
        <form onSubmit={create} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium adm-t2 mb-1">Slug</label>
              <input className="fb-input text-sm font-mono" placeholder="e.g. support"
                value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium adm-t2 mb-1">Kind</label>
              <select className="fb-input text-sm" value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="admin">Admin</option>
                <option value="premium">Premium</option>
                <option value="prefix">Prefix</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium adm-t2 mb-1">Reason</label>
            <input className="fb-input text-sm" placeholder="Why is this reserved?"
              value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm adm-t2">
              <input type="checkbox" checked={form.is_prefix}
                onChange={(e) => setForm({ ...form, is_prefix: e.target.checked })} />
              Prefix match (blocks anything starting with this)
            </label>
            <label className="flex items-center gap-2 text-sm adm-t2">
              <input type="checkbox" checked={form.premium}
                onChange={(e) => setForm({ ...form, premium: e.target.checked })} />
              Premium (held for assignment)
            </label>
          </div>
          <Btn type="submit" size="sm" disabled={creating}>
            <Ic d={IC.plus} size={16} strokeWidth={3} /> {creating ? 'Reserving…' : 'Reserve slug'}
          </Btn>
        </form>
      </Card>

      {/* ── Active reservations ────────────────────────────────── */}
      <h2 className="text-sm font-bold adm-t2 mb-3">Active reservations</h2>
      {loading ? (
        <p className="adm-t3 text-sm py-10 text-center">Loading…</p>
      ) : error ? (
        <p className="adm-t3 text-sm py-10 text-center">Could not load reservations.</p>
      ) : (
        <div className="adm-card rounded-2xl overflow-hidden mb-8">
          <div className="overflow-x-auto">
          <table className="adm-table w-full text-sm">
            <thead>
              <tr className="adm-th text-left text-xs font-semibold adm-t3">
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2 text-center">Prefix?</th>
                <th className="px-3 py-2 text-center">Premium?</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id} className="adm-hoverable">
                  <td className="px-3 py-2.5 font-mono adm-t1">{r.slug}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone="neutral">{r.kind}</Badge>
                  </td>
                  <td className="px-3 py-2.5 adm-t2">{r.reason || '—'}</td>
                  <td className="px-3 py-2.5 text-center">{r.is_prefix ? 'Yes' : '—'}</td>
                  <td className="px-3 py-2.5 text-center">{r.premium ? 'Yes' : '—'}</td>
                  <td className="px-3 py-2.5 text-xs adm-t3 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={() => release(r)} title="Release reservation"
                      className="adm-t3 hover:text-red-600 p-1">
                      <Ic d={IC.trash} size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {reservations.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-sm adm-t3 text-center">No active reservations yet.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ── System (code) reservations — read-only, collapsible ── */}
      <div className="adm-card rounded-2xl overflow-hidden">
        <button onClick={() => setShowSystem((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 adm-th text-left">
          <span className="text-sm font-bold adm-t2">System (code) reservations</span>
          {showSystem ? <Ic d={IC.chevD} size={16} className="adm-t3" /> : <Ic d={IC.chevR} size={16} className="adm-t3" />}
        </button>
        {showSystem && (
          <div className="p-4">
            <p className="text-xs adm-t3 mb-4">Protected in code — cannot be removed here.</p>
            {categoryEntries.length === 0 ? (
              <p className="text-sm adm-t3">No system reservations.</p>
            ) : (
              <div className="space-y-4">
                {categoryEntries.map(([category, list]) => (
                  <div key={category}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide adm-t3 mb-2">
                      {category} <span className="font-normal">({list.length})</span>
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((slug) => (
                        <span key={slug} className="text-xs font-mono px-2 py-0.5 rounded adm-chip">{slug}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReservedSlugs;
