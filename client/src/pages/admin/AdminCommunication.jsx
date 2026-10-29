import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  adminEmailTemplates, adminEmailTemplate, adminEmailUpdate, adminEmailDuplicate,
  adminEmailArchive, adminEmailPreview, adminEmailTest,
  adminEmailLogs, adminEmailRetry, adminEmailSettings, adminEmailSaveSettings, adminEmailEvents,
} from '../../services/api';
import { PageHeader, Card, Btn, Badge } from '../../components/admin/ui';
import AdminFilters from '../../components/admin/ui/AdminFilters';

const STATUS_TONE = {
  active: 'ok', draft: 'neutral',
  archived: 'warn', sent: 'ok',
  queued: 'info', failed: 'danger', test: 'info',
};

const Pill = ({ s }) => <Badge tone={STATUS_TONE[s] || 'neutral'}><span className="capitalize">{s}</span></Badge>;

const TAB_KEYS = ['templates', 'logs', 'settings', 'events'];

const AdminCommunication = () => {
  // Deep-link support: the ops dashboard "Failed emails" card links here with
  // ?tab=logs&status=failed. Seed initial tab + log status filter from the URL.
  const [searchParams] = useSearchParams();
  const initTab = TAB_KEYS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'templates';
  const [tab, setTab] = useState(initTab);

  // templates
  const [templates, setTemplates] = useState([]);
  const [filters, setFilters] = useState({ search: '', category: '', status: '' });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [preview, setPreview] = useState('');
  const [testTo, setTestTo] = useState('');
  const [saving, setSaving] = useState(false);

  // logs
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState({ email: '', status: searchParams.get('status') || '', event: '' });

  // settings + events
  const [settings, setSettings] = useState(null);
  const [events, setEvents] = useState([]);

  const loadTemplates = useCallback(() => {
    const p = {};
    if (filters.search) p.search = filters.search;
    if (filters.category) p.category = filters.category;
    if (filters.status) p.status = filters.status;
    adminEmailTemplates(p).then((r) => setTemplates(r.data)).catch(() => toast.error('Failed to load templates'));
  }, [filters]);

  const loadLogs = useCallback(() => {
    const p = {};
    if (logFilter.email) p.email = logFilter.email;
    if (logFilter.status) p.status = logFilter.status;
    if (logFilter.event) p.event = logFilter.event;
    adminEmailLogs(p).then((r) => setLogs(r.data)).catch(() => toast.error('Failed to load logs'));
  }, [logFilter]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);
  useEffect(() => { if (tab === 'logs') loadLogs(); }, [tab, loadLogs]);
  useEffect(() => { if (tab === 'settings' && !settings) adminEmailSettings().then((r) => setSettings(r.data)).catch(() => {}); }, [tab, settings]);
  useEffect(() => { if (tab === 'events' && !events.length) adminEmailEvents().then((r) => setEvents(r.data.events)).catch(() => {}); }, [tab, events.length]);

  const openEdit = async (t) => {
    const r = await adminEmailTemplate(t.id);
    setEditing(t.id); setForm(r.data); setPreview(''); setTestTo('');
  };

  const doPreview = async () => {
    try {
      // save current edits implicitly is not done; preview uses saved version,
      // so save-then-preview for accuracy
      await adminEmailUpdate(editing, form);
      const r = await adminEmailPreview(editing, {});
      setPreview(r.data.html);
      if (r.data.missing?.length) toast(`Unresolved: ${r.data.missing.join(', ')}`, { icon: '⚠️' });
    } catch (e) { toast.error(e?.response?.data?.message || 'Preview failed'); }
  };

  const save = async () => {
    setSaving(true);
    try { await adminEmailUpdate(editing, form); toast.success('Template saved'); loadTemplates(); }
    catch (e) { toast.error(e?.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const sendTest = async () => {
    if (!testTo.trim()) return toast.error('Enter a recipient email');
    try { await adminEmailUpdate(editing, form); const r = await adminEmailTest(editing, testTo.trim()); toast.success(r.data.message); }
    catch (e) { toast.error(e?.response?.data?.message || 'Test failed'); }
  };

  const duplicate = async (t) => { try { await adminEmailDuplicate(t.id); toast.success('Duplicated (draft)'); loadTemplates(); } catch { toast.error('Duplicate failed'); } };
  const archive = async (t) => { try { await adminEmailArchive(t.id); toast.success('Archived'); loadTemplates(); } catch (e) { toast.error(e?.response?.data?.message || 'Archive failed'); } };
  const retry = async (l) => { try { await adminEmailRetry(l.id); toast.success('Re-queued'); loadLogs(); } catch { toast.error('Retry failed'); } };

  const saveSettings = async () => {
    try { const r = await adminEmailSaveSettings(settings); setSettings(r.data); toast.success('Settings saved'); }
    catch (e) { toast.error(e?.response?.data?.message || 'Save failed'); }
  };

  return (
    <div>
      <PageHeader title="Communications" subtitle="Email templates, delivery logs, provider settings and system events. No campaigns or newsletters." />

      <div className="flex gap-1 mb-6 bg-[var(--adm-hover)] p-1 rounded-lg w-fit">
        {[['templates', 'Templates'], ['logs', 'Email Logs'], ['settings', 'Settings'], ['events', 'System Events']].map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setEditing(null); }}
            className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors ${tab === k ? 'adm-card shadow adm-t1' : 'adm-t3 hover:text-[color:var(--adm-text-2)]'}`}>{label}</button>
        ))}
      </div>

      {/* ── Templates ── */}
      {tab === 'templates' && !editing && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <input className="fb-input text-sm w-56" placeholder="Search templates…" value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
            <AdminFilters
              value={{ category: filters.category || undefined, status: filters.status || undefined }}
              onChange={(next) => setFilters((f) => ({ ...f, category: next.category || '', status: next.status || '' }))}
              config={[
                { key: 'category', label: 'Category', options: ['Authentication','Security','Booking','Profile','Badge','Subscription','Celebrations'].map((c) => ({ value: c, label: c })) },
                { key: 'status', label: 'Status', search: false, options: [{ value: 'active', label: 'Active' }, { value: 'draft', label: 'Draft' }, { value: 'archived', label: 'Archived' }] },
              ]}
            />
          </div>
          <div className="adm-card rounded-xl overflow-hidden">
            <table className="adm-table w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider adm-t3 border-b adm-border">
                <th className="px-4 py-2.5">Template</th><th className="px-4 py-2.5">Category</th><th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Last updated</th><th className="px-4 py-2.5">Actions</th>
              </tr></thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b adm-border last:border-0 adm-hoverable">
                    <td className="px-4 py-2.5"><span className="font-medium adm-t1">{t.name}</span><div className="text-[11px] adm-t3 font-mono">{t.event_key}{t.audience !== 'all' ? ` · ${t.audience}` : ''}</div></td>
                    <td className="px-4 py-2.5 text-xs adm-t2">{t.category}</td>
                    <td className="px-4 py-2.5"><Pill s={t.status} /></td>
                    <td className="px-4 py-2.5 text-xs adm-t3">{t.updated_at ? new Date(t.updated_at).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                      <button onClick={() => openEdit(t)} className="text-indigo-600 font-semibold hover:underline mr-3">Edit</button>
                      <button onClick={() => duplicate(t)} className="adm-t3 font-semibold hover:underline mr-3">Duplicate</button>
                      {t.status !== 'archived' && <button onClick={() => archive(t)} className="text-amber-600 font-semibold hover:underline">Archive</button>}
                    </td>
                  </tr>
                ))}
                {templates.length === 0 && <tr><td colSpan="5" className="text-center text-sm adm-t3 py-8">No templates.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Template editor ── */}
      {tab === 'templates' && editing && form && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={() => setEditing(null)} className="text-sm adm-t3 hover:text-[color:var(--adm-text-1)]">← Back</button>
              <span className="text-[11px] font-mono adm-t3">{form.event_key}</span>
            </div>
            <div><label className="block text-xs font-semibold adm-t3 mb-1">Template name</label>
              <input className="fb-input text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="block text-xs font-semibold adm-t3 mb-1">Subject</label>
              <input className="fb-input text-sm" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div><label className="block text-xs font-semibold adm-t3 mb-1">Preview text</label>
              <input className="fb-input text-sm" value={form.preview_text || ''} onChange={(e) => setForm({ ...form, preview_text: e.target.value })} /></div>
            <div><label className="block text-xs font-semibold adm-t3 mb-1">HTML body <span className="font-normal adm-t3">(no header/footer — added automatically)</span></label>
              <textarea className="fb-input text-xs font-mono" rows="11" value={form.html_content} onChange={(e) => setForm({ ...form, html_content: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-semibold adm-t3 mb-1">CTA label</label>
                <input className="fb-input text-sm" value={form.cta_label || ''} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} /></div>
              <div><label className="block text-xs font-semibold adm-t3 mb-1">CTA url</label>
                <input className="fb-input text-sm" value={form.cta_url || ''} onChange={(e) => setForm({ ...form, cta_url: e.target.value })} /></div>
            </div>
            <p className="text-[11px] adm-t3">Variables: <code>{'{{first_name}} {{service_name}} {{vendor_name}} {{booking_date}} {{booking_time}} {{otp}} {{badge_name}} {{plan_name}} {{support_email}}'}</code></p>
            <div className="flex gap-2 pt-2 border-t adm-border">
              <Btn size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
              <Btn variant="outline" size="sm" onClick={doPreview}>Live Preview</Btn>
              <input className="fb-input text-sm flex-1" placeholder="test@email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              <Btn variant="outline" size="sm" onClick={sendTest} className="!text-violet-700">Send Test</Btn>
            </div>
          </Card>
          <Card className="p-3">
            <p className="text-xs font-semibold adm-t3 px-1 pb-2">Live preview (sample data)</p>
            {preview
              ? <iframe title="preview" srcDoc={preview} className="w-full h-[640px] rounded-lg border adm-border" />
              : <div className="h-[640px] flex items-center justify-center text-sm adm-t3">Click “Live Preview” to render.</div>}
          </Card>
        </div>
      )}

      {/* ── Logs ── */}
      {tab === 'logs' && (
        <div className="adm-card rounded-xl overflow-hidden">
          <div className="flex flex-wrap gap-2 p-3 border-b adm-border">
            <input className="fb-input text-sm w-52" placeholder="Search by email…" value={logFilter.email} onChange={(e) => setLogFilter((f) => ({ ...f, email: e.target.value }))} />
            <input className="fb-input text-sm w-44" placeholder="Event key…" value={logFilter.event} onChange={(e) => setLogFilter((f) => ({ ...f, event: e.target.value }))} />
            <AdminFilters
              value={{ status: logFilter.status || undefined }}
              onChange={(next) => setLogFilter((f) => ({ ...f, status: next.status || '' }))}
              config={[{ key: 'status', label: 'Status', search: false, options: [{ value: 'sent', label: 'Sent' }, { value: 'queued', label: 'Queued' }, { value: 'failed', label: 'Failed' }] }]}
            />
            <Btn variant="outline" size="sm" onClick={loadLogs}>Refresh</Btn>
          </div>
          <div className="overflow-x-auto">
            <table className="adm-table w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider adm-t3 border-b adm-border">
                <th className="px-4 py-2">Time</th><th className="px-4 py-2">Recipient</th><th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Status</th><th className="px-4 py-2">Tries</th><th className="px-4 py-2">Error</th><th className="px-4 py-2"></th>
              </tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b adm-border last:border-0 adm-hoverable">
                    <td className="px-4 py-2 text-xs adm-t3 whitespace-nowrap">{new Date(l.created_at).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2 text-xs adm-t2">{l.recipient}</td>
                    <td className="px-4 py-2 font-mono text-[11px] adm-t2">{l.event_key}</td>
                    <td className="px-4 py-2"><Pill s={l.status} /></td>
                    <td className="px-4 py-2 text-xs adm-t2">{l.attempts}</td>
                    <td className="px-4 py-2 text-xs text-red-500 max-w-[200px] truncate" title={l.error || ''}>{l.error || '—'}</td>
                    <td className="px-4 py-2">{l.status === 'failed' && <button onClick={() => retry(l)} className="text-xs font-semibold text-indigo-600 hover:underline">Retry</button>}</td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan="7" className="text-center text-sm adm-t3 py-8">No email logs.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Settings ── */}
      {tab === 'settings' && settings && (
        <Card className="max-w-2xl space-y-3">
          <div><label className="block text-xs font-semibold adm-t3 mb-1">Provider</label>
            <select className="fb-input text-sm w-44" value={settings.provider} onChange={(e) => setSettings({ ...settings, provider: e.target.value })}>
              <option value="smtp">SMTP</option><option value="resend">Resend</option><option value="ses">Amazon SES</option>
            </select>
            <p className="text-[11px] adm-t3 mt-1">Swap providers without code changes. SMTP is the default.</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-semibold adm-t3 mb-1">From name</label>
              <input className="fb-input text-sm" value={settings.from_name || ''} onChange={(e) => setSettings({ ...settings, from_name: e.target.value })} /></div>
            <div><label className="block text-xs font-semibold adm-t3 mb-1">From email</label>
              <input className="fb-input text-sm" value={settings.from_email || ''} onChange={(e) => setSettings({ ...settings, from_email: e.target.value })} /></div>
            <div><label className="block text-xs font-semibold adm-t3 mb-1">Support email</label>
              <input className="fb-input text-sm" value={settings.support_email || ''} onChange={(e) => setSettings({ ...settings, support_email: e.target.value })} /></div>
            <div><label className="block text-xs font-semibold adm-t3 mb-1">Website URL</label>
              <input className="fb-input text-sm" value={settings.website_url || ''} onChange={(e) => setSettings({ ...settings, website_url: e.target.value })} /></div>
            <div><label className="block text-xs font-semibold adm-t3 mb-1">Logo URL</label>
              <input className="fb-input text-sm" value={settings.logo_url || ''} onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })} /></div>
            <div><label className="block text-xs font-semibold adm-t3 mb-1">Brand color</label>
              <input className="fb-input text-sm" value={settings.brand_color || ''} onChange={(e) => setSettings({ ...settings, brand_color: e.target.value })} /></div>
          </div>
          <Btn size="sm" onClick={saveSettings}>Save settings</Btn>
        </Card>
      )}

      {/* ── Events ── */}
      {tab === 'events' && (
        <div className="adm-card rounded-xl overflow-hidden">
          <table className="adm-table w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider adm-t3 border-b adm-border">
              <th className="px-4 py-2.5">Event</th><th className="px-4 py-2.5">Templates</th><th className="px-4 py-2.5">Active</th>
            </tr></thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.event_key} className="border-b adm-border last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs adm-t2">{ev.event_key}</td>
                  <td className="px-4 py-2.5 text-xs adm-t2">{ev.templates.map((t) => t.name).join(', ')}</td>
                  <td className="px-4 py-2.5">{ev.has_active ? <Pill s="active" /> : <span className="text-xs text-red-500 font-semibold">none</span>}</td>
                </tr>
              ))}
              {events.length === 0 && <tr><td colSpan="3" className="text-center text-sm adm-t3 py-8">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminCommunication;
