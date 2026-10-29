import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { PageHeader, Card, Btn, Badge } from '../../components/admin/ui';
import { adminGetInviteLinks, adminCreateInviteLink, adminUpdateInviteLink } from '../../services/api';

// Invite Links admin — lead-source attribution (NO payouts, separate from Refer & Earn).
export default function AdminInviteLinks() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ slug: '', label: '', assigned_to: '' });

  const load = useCallback(() => {
    setLoading(true);
    adminGetInviteLinks()
      .then((r) => setLinks(Array.isArray(r.data) ? r.data : []))
      .catch(() => toast.error('Failed to load invite links'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e) {
    e.preventDefault();
    if (!form.slug.trim() || !form.label.trim()) return toast.error('Slug and label required');
    try {
      await adminCreateInviteLink(form);
      toast.success('Invite link created');
      setForm({ slug: '', label: '', assigned_to: '' });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Create failed');
    }
  }

  async function toggleActive(l) {
    try { await adminUpdateInviteLink(l.slug, { active: !l.active }); load(); }
    catch { toast.error('Update failed'); }
  }

  const inputCls = 'mt-1 rounded-lg border-2 border-neutral-300 px-3 py-2 text-sm';

  return (
    <div>
      <PageHeader title="Invite Links" subtitle="Lead-source attribution links — no payouts." />

      <Card className="mb-6">
        <form onSubmit={create} className="flex flex-wrap items-end gap-3 p-1">
          <label className="flex flex-col text-xs font-medium text-neutral-500">
            Slug (immutable)
            <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="social" className={inputCls} />
          </label>
          <label className="flex flex-col text-xs font-medium text-neutral-500">
            Label
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Social Squad" className={inputCls} />
          </label>
          <label className="flex flex-col text-xs font-medium text-neutral-500">
            Assigned to
            <input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              placeholder="Instagram / Ravi / QR code" className={inputCls} />
          </label>
          <Btn type="submit">Create link</Btn>
        </form>
      </Card>

      <Card>
        {loading ? (
          <p className="p-4 text-sm text-neutral-500">Loading…</p>
        ) : links.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">No invite links yet. Create one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="p-2">Link</th><th className="p-2">Label</th><th className="p-2">Assigned</th>
                  <th className="p-2">Unique visits</th><th className="p-2">Signups</th><th className="p-2">Conv %</th><th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => {
                  const conv = l.unique_visits ? ((l.signups / l.unique_visits) * 100).toFixed(1) + '%' : '—';
                  return (
                    <tr key={l.slug} className="border-t border-neutral-100">
                      <td className="p-2 font-mono text-xs">/invite/{l.slug}</td>
                      <td className="p-2">{l.label}</td>
                      <td className="p-2">{l.assigned_to || '—'}</td>
                      <td className="p-2">{l.unique_visits}</td>
                      <td className="p-2">{l.signups}</td>
                      <td className="p-2">{conv}</td>
                      <td className="p-2">
                        <button onClick={() => toggleActive(l)} title="Toggle active">
                          <Badge tone={l.active ? 'ok' : 'neutral'}>{l.active ? 'Active' : 'Disabled'}</Badge>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
