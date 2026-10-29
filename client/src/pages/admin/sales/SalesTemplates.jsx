import { useEffect, useState } from 'react';
import { PageHeader, Card, Btn, Badge } from '../../../components/admin/ui';
import { crmListTemplates, crmCreateTemplate, crmDeleteTemplate } from '../../../services/api';
import toast from 'react-hot-toast';

const CATEGORIES = ['first_outreach', 'follow_up', 'demo', 'trial', 'activation', 'payment', 'winback', 'announcement', 'custom'];

export default function SalesTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = () => crmListTemplates()
    .then(({ data }) => setTemplates(Array.isArray(data) ? data : []))
    .catch(() => setTemplates([]))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const del = async (id) => {
    if (!confirm('Remove this template from the picker?')) return;
    try { await crmDeleteTemplate(id); load(); } catch { toast.error('Failed'); }
  };

  const wa = templates.filter((t) => t.channel === 'whatsapp');
  const email = templates.filter((t) => t.channel === 'email');

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader title="Message Templates" subtitle="Approved WhatsApp templates + reusable emails the team sends from."
        actions={<div className="flex items-center gap-3"><a href="/admin/sales/sequences" className="text-[12px] adm-t2 hover:text-[#0079C1]">Sequences →</a><Btn size="sm" onClick={() => setShowNew(true)}>+ New template</Btn></div>} />

      {loading ? <p className="adm-t3">Loading…</p> : (
        <>
          <Section title="WhatsApp" note="name = the exact approved AiSensy campaign name" items={wa} onDelete={del} />
          <Section title="Email" note="reusable subject + HTML body" items={email} onDelete={del} />
        </>
      )}

      {showNew && <NewTemplateModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function Section({ title, note, items, onDelete }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-bold adm-t2 uppercase tracking-wide mb-1">{title} <span className="adm-t3 font-normal">({items.length})</span></h2>
      <p className="text-[11px] adm-t3 mb-3">{note}</p>
      {items.length === 0 ? <Card className="rounded-2xl p-6 text-center adm-t3 text-sm">None yet.</Card> : (
        <div className="space-y-2">
          {items.map((t) => (
            <Card key={t.id} className="rounded-xl p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold adm-t1">{t.label}</p>
                  <Badge tone="neutral">{t.category}</Badge>
                  <code className="text-[10px] adm-t3">{t.name}</code>
                </div>
                {t.channel === 'whatsapp' && (t.variables || []).length > 0 && (
                  <p className="text-[11px] adm-t2 mt-1">Slots: {t.variables.map((v, i) => `${i + 1}.${v.label || v.key}`).join('  ')}</p>
                )}
                {t.channel === 'email' && t.subject && <p className="text-[11px] adm-t2 mt-1">Subject: {t.subject}</p>}
              </div>
              <button onClick={() => onDelete(t.id)} className="text-[12px] text-red-500 flex-shrink-0">Remove</button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NewTemplateModal({ onClose, onCreated }) {
  const [channel, setChannel] = useState('whatsapp');
  const [form, setForm] = useState({ name: '', label: '', category: 'first_outreach', subject: '', body: '' });
  const [vars, setVars] = useState([{ key: '', label: '', example: '' }]);
  const [busy, setBusy] = useState(false);

  const f = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });
  const setVar = (i, k, val) => setVars(vars.map((v, j) => (j === i ? { ...v, [k]: val } : v)));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.label.trim()) return toast.error('Name and label required');
    setBusy(true);
    try {
      const variables = channel === 'whatsapp'
        ? vars.filter((v) => v.key.trim()).map((v) => ({ key: v.key.trim(), label: v.label.trim() || v.key.trim(), example: v.example.trim() }))
        : [];
      await crmCreateTemplate({ channel, name: form.name, label: form.label, category: form.category, variables, subject: form.subject, body: form.body });
      toast.success('Template saved');
      onCreated();
    } catch (err) { toast.error(err.response?.data?.message || 'Could not save'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="rounded-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-auto">
        <div onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold adm-t1">New template</h2>
            <button onClick={onClose} className="adm-t3 text-xl leading-none">×</button>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="flex gap-2">
              {['whatsapp', 'email'].map((ch) => (
                <button key={ch} type="button" onClick={() => setChannel(ch)}
                  className={`text-[12px] px-3 py-1.5 rounded-full border ${channel === ch ? 'bg-[#0079C1] text-white border-[#0079C1]' : 'adm-t2 border-gray-200'}`}>
                  {ch === 'whatsapp' ? 'WhatsApp' : 'Email'}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium adm-t2 mb-1">{channel === 'whatsapp' ? 'Approved AiSensy name' : 'Internal key/name'}</label>
                <input className="fb-input text-sm font-mono" placeholder={channel === 'whatsapp' ? 'e.g. sales_first_outreach' : 'e.g. cold_intro'} {...f('name')} />
              </div>
              <div>
                <label className="block text-[11px] font-medium adm-t2 mb-1">Label</label>
                <input className="fb-input text-sm" placeholder="Shown in picker" {...f('label')} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium adm-t2 mb-1">Category</label>
              <select className="fb-input text-sm" {...f('category')}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            </div>

            {channel === 'whatsapp' ? (
              <div>
                <label className="block text-[11px] font-medium adm-t2 mb-1">Variable slots (in template order)</label>
                <div className="space-y-2">
                  {vars.map((v, i) => (
                    <div key={i} className="grid grid-cols-3 gap-2">
                      <input className="fb-input text-xs" placeholder="key (first_name)" value={v.key} onChange={(e) => setVar(i, 'key', e.target.value)} />
                      <input className="fb-input text-xs" placeholder="label" value={v.label} onChange={(e) => setVar(i, 'label', e.target.value)} />
                      <input className="fb-input text-xs" placeholder="example" value={v.example} onChange={(e) => setVar(i, 'example', e.target.value)} />
                    </div>
                  ))}
                </div>
                <button type="button" className="text-[12px] text-[#0079C1] mt-2" onClick={() => setVars([...vars, { key: '', label: '', example: '' }])}>+ Add slot</button>
                <p className="text-[10px] adm-t3 mt-1">Order must match the approved template's variables exactly.</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-[11px] font-medium adm-t2 mb-1">Subject</label>
                  <input className="fb-input text-sm" placeholder="Supports {{first_name}}" {...f('subject')} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium adm-t2 mb-1">HTML body</label>
                  <textarea className="fb-input text-sm" rows={5} placeholder="HTML — {{first_name}}, {{business_name}}…" {...f('body')} />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Btn variant="outline" size="sm" type="button" onClick={onClose}>Cancel</Btn>
              <Btn size="sm" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save template'}</Btn>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
