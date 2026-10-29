import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  adminCampaigns, adminCampCreate, adminCampLaunch,
  adminCampSegments, adminCampSegPreview, adminCampSyncContacts,
  adminEmailTemplates, adminCampWaTemplates, adminCampWaCreate, adminCampRecipients, adminCampResolveAudience,
} from '../../services/api';
import { PageHeader, Card, Btn, Badge } from '../../components/admin/ui';
import AdminCampaignComposer from './AdminCampaignComposer';

const LARGE_AUDIENCE = 50; // above this, require typing the exact count to confirm

const STATUS_TONE = { draft: 'neutral', scheduled: 'info',
  sending: 'warn', sent: 'ok',
  paused: 'info', failed: 'danger',
  // per-recipient states (campaign detail)
  queued: 'neutral', delivered: 'ok', opened: 'info', clicked: 'ok', bounced: 'danger', skipped: 'neutral' };
const Pill = ({ s }) => <Badge tone={STATUS_TONE[s] || 'neutral'}><span className="capitalize">{s}</span></Badge>;

const BLANK = { name: '', channel: 'email', segment_id: '', template_id: '', whatsapp_template_id: '', subject_override: '', throttle_per_min: 120 };

const AdminCampaigns = () => {
  const [list, setList] = useState([]);
  const [segments, setSegments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [waTemplates, setWaTemplates] = useState([]);
  const [building, setBuilding] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [count, setCount] = useState(null);

  const [composing, setComposing] = useState(false);
  // Campaign detail / history
  const [detailTarget, setDetailTarget] = useState(null);
  const [detail, setDetail] = useState(null); // {summary, recipients, truncated}
  // Launch confirmation
  const [launchTarget, setLaunchTarget] = useState(null); // campaign row
  const [launchCount, setLaunchCount] = useState(null);   // resolved recipient count
  const [launchTyped, setLaunchTyped] = useState('');
  const [launching, setLaunching] = useState(false);
  // WhatsApp template registry
  const [waManage, setWaManage] = useState(false);
  const [waForm, setWaForm] = useState({ name: '', aisensy_campaign_name: '', fields: '' });

  const load = useCallback(() => { adminCampaigns().then((r) => setList(r.data)).catch(() => toast.error('Failed to load campaigns')); }, []);
  const loadWa = useCallback(() => { adminCampWaTemplates().then((r) => setWaTemplates(r.data)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    adminCampSegments().then((r) => setSegments(r.data)).catch(() => {});
    adminEmailTemplates({ status: 'active' }).then((r) => setTemplates(r.data)).catch(() => {});
    loadWa();
  }, [loadWa]);

  const previewCount = async (segId, channel) => {
    const seg = segments.find((s) => s.id === segId);
    if (!seg) return setCount(null);
    try { const r = await adminCampSegPreview(seg.definition, channel); setCount(r.data.count); } catch { setCount(null); }
  };

  const save = async () => {
    const isWa = form.channel === 'whatsapp';
    if (!form.name || !form.segment_id) return toast.error('Name and segment are required');
    if (isWa && !form.whatsapp_template_id) return toast.error('Select an approved WhatsApp template');
    if (!isWa && !form.template_id) return toast.error('Select an email template');
    try {
      await adminCampCreate(form); toast.success('Draft saved');
      setBuilding(false); setForm(BLANK); setCount(null); load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Save failed'); }
  };

  const openLaunch = async (c) => {
    setLaunchTarget(c); setLaunchCount(null); setLaunchTyped('');
    try {
      const r = await adminCampResolveAudience({
        audience_type: c.audience_type || 'segment', segment_id: c.segment_id || null,
        audience_ref: c.audience_ref || null, channel: c.channel || 'email',
      });
      setLaunchCount(r.data.count);
    } catch { setLaunchCount(-1); } // -1 = count unavailable (still allow, with a warning)
  };
  const closeLaunch = () => { setLaunchTarget(null); setLaunchCount(null); setLaunchTyped(''); };
  const doLaunch = async () => {
    if (!launchTarget) return;
    setLaunching(true);
    try { const r = await adminCampLaunch(launchTarget.id); toast.success(r.data.message); closeLaunch(); load(); }
    catch (e) { toast.error(e?.response?.data?.message || 'Launch failed'); }
    finally { setLaunching(false); }
  };
  const needsTyped = launchCount > LARGE_AUDIENCE;
  const canLaunch = launchCount !== 0 && (!needsTyped || launchTyped.trim() === String(launchCount));

  const openDetail = async (c) => {
    setDetailTarget(c); setDetail(null);
    try { const r = await adminCampRecipients(c.id); setDetail(r.data); }
    catch { setDetail({ summary: { total: 0 }, recipients: [] }); }
  };

  const syncContacts = async () => {
    try { const r = await adminCampSyncContacts(); toast.success(`Synced ${r.data.upserted} contacts`); }
    catch { toast.error('Sync failed'); }
  };

  const saveWaTemplate = async () => {
    if (!waForm.name || !waForm.aisensy_campaign_name) return toast.error('Name and AiSensy campaign name are required');
    // "fields" = comma-separated contact fields for {{1}},{{2}}… → variable_map.
    const fields = waForm.fields.split(',').map((f) => f.trim()).filter(Boolean);
    const variable_map = {}; fields.forEach((f, i) => { variable_map[i + 1] = f; });
    try {
      await adminCampWaCreate({ name: waForm.name, aisensy_campaign_name: waForm.aisensy_campaign_name, variable_map, param_count: fields.length });
      toast.success('WhatsApp template added'); setWaForm({ name: '', aisensy_campaign_name: '', fields: '' }); loadWa();
    } catch (e) { toast.error(e?.response?.data?.message || 'Save failed'); }
  };

  const isWa = form.channel === 'whatsapp';

  if (composing) return <AdminCampaignComposer onClose={() => { setComposing(false); load(); }} />;

  return (
    <div>
      <PageHeader title="Campaigns" subtitle="Targeted Email & WhatsApp campaigns to consented segments."
        actions={<>
          <Btn variant="outline" size="sm" onClick={() => setWaManage((v) => !v)}>WhatsApp templates</Btn>
          <Btn variant="outline" size="sm" onClick={syncContacts}>Sync contacts</Btn>
          <Btn variant="outline" size="sm" onClick={() => setBuilding(true)}>Template campaign</Btn>
          <Btn size="sm" onClick={() => setComposing(true)}>Create Email</Btn>
        </>} />

      {/* WhatsApp template registry */}
      {waManage && (
        <Card className="mb-6 max-w-2xl">
          <p className="text-sm font-semibold adm-t1 mb-3">Approved AiSensy templates</p>
          <div className="space-y-1 mb-4">
            {waTemplates.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm border-b adm-border last:border-0 py-1.5">
                <span className="font-medium adm-t1">{t.name} <span className="adm-t3 font-mono text-xs">({t.aisensy_campaign_name})</span></span>
                <span className="text-[11px] adm-t3">{t.param_count} vars · {t.approval_status}</span>
              </div>
            ))}
            {waTemplates.length === 0 && <p className="text-xs adm-t3">No WhatsApp templates yet.</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input className="fb-input text-sm" placeholder="Label" value={waForm.name} onChange={(e) => setWaForm({ ...waForm, name: e.target.value })} />
            <input className="fb-input text-sm" placeholder="AiSensy campaign name" value={waForm.aisensy_campaign_name} onChange={(e) => setWaForm({ ...waForm, aisensy_campaign_name: e.target.value })} />
            <input className="fb-input text-sm" placeholder="Fields for {{1}},{{2}}… (comma-sep)" value={waForm.fields} onChange={(e) => setWaForm({ ...waForm, fields: e.target.value })} />
          </div>
          <p className="text-[11px] adm-t3 mt-1">e.g. <code>first_name, service_name, vendor_name</code> maps to {'{{1}} {{2}} {{3}}'}.</p>
          <Btn size="sm" onClick={saveWaTemplate} className="mt-3">Add template</Btn>
        </Card>
      )}

      {building && (
        <Card className="mb-6 max-w-2xl space-y-3">
          <div><label className="block text-xs font-semibold adm-t3 mb-1">Channel</label>
            <select className="fb-input text-sm" value={form.channel}
              onChange={(e) => { const channel = e.target.value; setForm({ ...form, channel }); if (form.segment_id) previewCount(form.segment_id, channel); }}>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select></div>
          <div><label className="block text-xs font-semibold adm-t3 mb-1">Campaign name</label>
            <input className="fb-input text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="block text-xs font-semibold adm-t3 mb-1">Audience (segment)</label>
            <select className="fb-input text-sm" value={form.segment_id}
              onChange={(e) => { setForm({ ...form, segment_id: e.target.value }); previewCount(e.target.value, form.channel); }}>
              <option value="">Select a segment…</option>
              {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {count !== null && <p className="text-[11px] adm-t2 mt-1">≈ {count} consented {isWa ? 'WhatsApp' : 'email'} recipients</p>}
          </div>

          {isWa ? (
            <div><label className="block text-xs font-semibold adm-t3 mb-1">Approved WhatsApp template</label>
              <select className="fb-input text-sm" value={form.whatsapp_template_id} onChange={(e) => setForm({ ...form, whatsapp_template_id: e.target.value })}>
                <option value="">Select a template…</option>
                {waTemplates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.param_count} vars)</option>)}
              </select>
              {waTemplates.length === 0 && <p className="text-[11px] text-amber-600 mt-1">No WhatsApp templates yet — add one via “WhatsApp templates”.</p>}
            </div>
          ) : (
            <>
              <div><label className="block text-xs font-semibold adm-t3 mb-1">Email template</label>
                <select className="fb-input text-sm" value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })}>
                  <option value="">Select a template…</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select></div>
              <div><label className="block text-xs font-semibold adm-t3 mb-1">Subject override (optional)</label>
                <input className="fb-input text-sm" value={form.subject_override} onChange={(e) => setForm({ ...form, subject_override: e.target.value })} /></div>
            </>
          )}

          <div className="flex gap-2 pt-2 border-t adm-border">
            <Btn size="sm" onClick={save}>Save draft</Btn>
            <Btn variant="outline" size="sm" onClick={() => { setBuilding(false); setForm(BLANK); setCount(null); }}>Cancel</Btn>
          </div>
        </Card>
      )}

      <div className="adm-card rounded-xl overflow-hidden">
        <table className="adm-table w-full text-sm">
          <thead><tr className="text-left text-[11px] uppercase tracking-wider adm-t3 border-b adm-border">
            <th className="px-4 py-2.5">Campaign</th><th className="px-4 py-2.5">Channel</th><th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5">Sent/Total</th><th className="px-4 py-2.5">Created</th><th className="px-4 py-2.5">Actions</th>
          </tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-b adm-border last:border-0 adm-hoverable">
                <td className="px-4 py-2.5 font-medium adm-t1">
                  <button onClick={() => openDetail(c)} className="hover:underline text-left">{c.name}</button>
                </td>
                <td className="px-4 py-2.5 text-xs capitalize adm-t2">{c.channel}</td>
                <td className="px-4 py-2.5"><Pill s={c.status} /></td>
                <td className="px-4 py-2.5 text-xs adm-t2">{(c.stats?.sent ?? 0)}/{(c.stats?.total ?? 0)}</td>
                <td className="px-4 py-2.5 text-xs adm-t3">{c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '—'}</td>
                <td className="px-4 py-2.5 text-xs">
                  {['draft', 'scheduled'].includes(c.status)
                    ? <button onClick={() => openLaunch(c)} className="text-indigo-600 font-semibold hover:underline">Launch</button>
                    : <span className="adm-t3">—</span>}
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="6" className="text-center text-sm adm-t3 py-8">No campaigns yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Campaign history / delivery detail */}
      {detailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetailTarget(null)}>
          <div className="adm-card rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b adm-border">
              <div>
                <p className="text-sm font-semibold adm-t1">{detailTarget.name}</p>
                <p className="text-[11px] adm-t3 capitalize">{detailTarget.channel} · {detailTarget.status}</p>
              </div>
              <button onClick={() => setDetailTarget(null)} className="adm-t3 text-lg leading-none">×</button>
            </div>

            {!detail ? <p className="text-xs adm-t3 p-4">Loading…</p> : (
              <>
                <div className="flex flex-wrap gap-2 px-4 py-3 border-b adm-border">
                  {[['total', 'Total'], ['queued', 'Queued'], ['sent', 'Sent'], ['delivered', 'Delivered'], ['opened', 'Opened'], ['clicked', 'Clicked'], ['bounced', 'Bounced'], ['failed', 'Failed'], ['skipped', 'Skipped']]
                    .filter(([k]) => detail.summary[k])
                    .map(([k, label]) => {
                      // Open/click rate against delivered — the number you actually read.
                      const d = detail.summary.delivered || 0;
                      const pct = (k === 'opened' || k === 'clicked') && d ? ` (${Math.round((detail.summary[k] / d) * 100)}%)` : '';
                      return (
                        <span key={k} className="text-[11px] px-2 py-1 rounded border adm-border adm-t2">
                          {label}: <span className="font-semibold adm-t1">{detail.summary[k]}{pct}</span>
                        </span>
                      );
                    })}
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-left uppercase tracking-wide adm-t3 border-b adm-border sticky top-0 adm-card">
                      <th className="px-4 py-2">Name</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Delivery</th>
                    </tr></thead>
                    <tbody>
                      {detail.recipients.map((r) => (
                        <tr key={r.id} className="border-b adm-border last:border-0">
                          <td className="px-4 py-1.5 adm-t1">{r.name || '—'}</td>
                          <td className="px-4 py-1.5 adm-t2">{r.email}</td>
                          <td className="px-4 py-1.5"><Pill s={r.status} /></td>
                          <td className="px-4 py-1.5">
                            {r.delivery ? <Pill s={r.delivery} /> : <span className="adm-t3">{r.error ? r.error : '—'}</span>}
                          </td>
                        </tr>
                      ))}
                      {detail.recipients.length === 0 && <tr><td colSpan="4" className="px-4 py-6 text-center adm-t3">No recipients yet — launch to snapshot the audience.</td></tr>}
                    </tbody>
                  </table>
                </div>
                {detail.truncated && <p className="text-[11px] adm-t3 px-4 py-2 border-t adm-border">Showing first 1000.</p>}
              </>
            )}
          </div>
        </div>
      )}

      {/* Launch confirmation + typed-count guardrail */}
      {launchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeLaunch}>
          <div className="adm-card rounded-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold adm-t1 mb-1">Send “{launchTarget.name}”?</p>
            {launchCount === null ? (
              <p className="text-xs adm-t3 py-3">Counting recipients…</p>
            ) : launchCount === -1 ? (
              <p className="text-xs text-amber-600 py-2">Couldn’t resolve the recipient count. You can still send, but double-check the audience first.</p>
            ) : (
              <p className="text-sm adm-t2 my-2">
                This sends to <span className="font-bold adm-t1">{launchCount}</span> consented recipient{launchCount === 1 ? '' : 's'}
                {launchTarget.channel !== 'whatsapp' && <> as <span className="font-medium">Shubham &lt;shubham@meeticulous.in&gt;</span></>}.
                {launchCount === 0 && <span className="block text-amber-600 mt-1">No consented recipients — nothing to send.</span>}
              </p>
            )}
            {needsTyped && (
              <div className="my-3">
                <label className="block text-xs font-semibold adm-t3 mb-1">Large audience — type <span className="font-mono adm-t1">{launchCount}</span> to confirm</label>
                <input className="fb-input text-sm" value={launchTyped} onChange={(e) => setLaunchTyped(e.target.value)} placeholder={String(launchCount)} />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="outline" size="sm" onClick={closeLaunch}>Cancel</Btn>
              <Btn size="sm" onClick={doLaunch} disabled={launching || launchCount === null || !canLaunch}>
                {launching ? 'Sending…' : `Send${launchCount > 0 ? ` to ${launchCount}` : ''}`}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCampaigns;
