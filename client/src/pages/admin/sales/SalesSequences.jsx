import { useEffect, useState } from 'react';
import { PageHeader, Card, Btn, Badge } from '../../../components/admin/ui';
import SequenceFlow from '../../../components/admin/SequenceFlow';
import { crmListSequences, crmCreateSequence, crmListTemplates } from '../../../services/api';
import toast from 'react-hot-toast';

// Drip sequences the lifecycle engine (and manual enrolment) fire step by step
// through the gated send queue. Names matching the engine's SEQ constants
// (e.g. "New Lead nurture") are auto-enrolled; any others are manual-enrol only.
//
// `audience` scopes the page (v3.160): 'customer' = host lifecycle (Growth),
// 'lead' = cold acquisition drips (Marketing). The list is filtered server-side
// by this value; new sequences created here are stamped with it.

const CHANNELS = ['email', 'whatsapp'];

export default function SalesSequences({
  audience = null,
  title = 'Sequences',
  subtitle = 'Automated drip journeys. Steps fire through the gated send queue — nothing sends while the CRM kill-switch is off.',
}) {
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [openId, setOpenId] = useState(null); // sequence whose flowchart is expanded

  const load = () => crmListSequences(audience)
    .then(({ data }) => setSequences(Array.isArray(data) ? data : []))
    .catch(() => setSequences([]))
    .finally(() => setLoading(false));
  useEffect(() => { setLoading(true); load(); }, [audience]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader title={title} subtitle={subtitle}
        actions={<Btn size="sm" onClick={() => setShowNew(true)}>+ New sequence</Btn>} />

      {loading ? <p className="adm-t3">Loading…</p> : sequences.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center">
          <p className="adm-t1 font-semibold mb-1">No sequences yet</p>
          <p className="adm-t3 text-sm mb-4">Build a nurture journey once; enrol {audience === 'lead' ? 'leads' : 'hosts'} into it from the lead panel.</p>
          <Btn size="sm" onClick={() => setShowNew(true)}>+ New sequence</Btn>
        </Card>
      ) : (
        <div className="space-y-3">
          {sequences.map((s) => (
            <SequenceCard key={s.id} seq={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)} />
          ))}
        </div>
      )}

      {showNew && <NewSequenceModal audience={audience} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function SequenceCard({ seq, open, onToggle }) {
  const steps = [...(seq.crm_sequence_steps || [])].sort((a, b) => a.step_no - b.step_no);
  const channels = [...new Set(steps.map((s) => s.channel))];
  return (
    <Card className="rounded-2xl p-4">
      <button type="button" onClick={onToggle} className="w-full text-left" aria-expanded={open}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="adm-t3 text-xs" aria-hidden>{open ? '▾' : '▸'}</span>
              <h3 className="font-bold adm-t1">{seq.name}</h3>
              <Badge tone={seq.is_active ? 'ok' : 'neutral'}>{seq.is_active ? 'Active' : 'Inactive'}</Badge>
            </div>
            {seq.description && <p className="text-[12px] adm-t3 mt-0.5">{seq.description}</p>}
          </div>
          <div className="text-[11px] adm-t3 text-right shrink-0">
            {steps.length} step{steps.length === 1 ? '' : 's'} · {channels.join(', ') || '—'}
            <div className="mt-0.5">{open ? 'Hide flow' : 'View flow'}</div>
          </div>
        </div>
      </button>

      {open ? (
        <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--adm-border)' }}>
          <SequenceFlow seq={seq} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {steps.map((st) => (
              <span key={st.id || st.step_no} className="text-[10px] px-2 py-0.5 rounded-md bg-gray-500/8 adm-t2">
                {st.step_no}. {st.channel} · +{st.delay_hours}h {st.channel === 'whatsapp' ? (st.template_key || '') : (st.subject || '')}
              </span>
            ))}
          </div>
          <p className="text-[10px] adm-t3 mt-2">
            Stops on: {[seq.stop_on_reply && 'reply', seq.stop_on_convert && 'convert'].filter(Boolean).join(', ') || 'never'}
          </p>
        </>
      )}
    </Card>
  );
}

const emptyStep = () => ({ channel: 'email', delay_hours: 0, template_key: '', subject: '', body: '' });

function NewSequenceModal({ audience, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', stop_on_reply: true, stop_on_convert: true });
  const [steps, setSteps] = useState([emptyStep()]);
  const [waTemplates, setWaTemplates] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { crmListTemplates('whatsapp').then(({ data }) => setWaTemplates(Array.isArray(data) ? data : [])).catch(() => {}); }, []);

  const setStep = (i, k, v) => setSteps(steps.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const addStep = () => setSteps([...steps, emptyStep()]);
  const removeStep = (i) => setSteps(steps.filter((_, j) => j !== i));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name required');
    for (const s of steps) {
      if (s.channel === 'whatsapp' && !s.template_key) return toast.error('Pick a WhatsApp template for every WhatsApp step');
      if (s.channel === 'email' && (!s.subject.trim() || !s.body.trim())) return toast.error('Email steps need a subject and body');
    }
    setBusy(true);
    try {
      await crmCreateSequence({
        name: form.name.trim(), description: form.description.trim(),
        audience: audience === 'lead' ? 'lead' : 'customer', // stamp the page's audience
        stop_on_reply: form.stop_on_reply, stop_on_convert: form.stop_on_convert,
        steps: steps.map((s) => ({
          channel: s.channel, delay_hours: Number(s.delay_hours) || 0,
          template_key: s.channel === 'whatsapp' ? s.template_key : null,
          subject: s.channel === 'email' ? s.subject : null,
          body: s.channel === 'email' ? s.body : null,
        })),
      });
      toast.success('Sequence created');
      onCreated();
    } catch (err) { toast.error(err.response?.data?.message || 'Could not save'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="rounded-2xl p-5 w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold adm-t1">New sequence</h2>
            <button onClick={onClose} className="adm-t3 text-xl leading-none">×</button>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input className="fb-input text-sm" placeholder="Name (e.g. New Lead nurture)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="fb-input text-sm" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex gap-4 text-[12px] adm-t2">
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={form.stop_on_reply} onChange={(e) => setForm({ ...form, stop_on_reply: e.target.checked })} /> Stop on reply</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={form.stop_on_convert} onChange={(e) => setForm({ ...form, stop_on_convert: e.target.checked })} /> Stop on convert</label>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-medium adm-t2">Steps (fire in order; delay is from the previous step)</p>
              {steps.map((s, i) => (
                <div key={i} className="rounded-xl border border-gray-200 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold adm-t3">Step {i + 1}</span>
                    <select className="fb-input text-xs !py-1 w-28" value={s.channel} onChange={(e) => setStep(i, 'channel', e.target.value)}>
                      {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <label className="text-[11px] adm-t3 flex items-center gap-1">wait
                      <input type="number" min="0" className="fb-input text-xs !py-1 w-16" value={s.delay_hours} onChange={(e) => setStep(i, 'delay_hours', e.target.value)} /> h
                    </label>
                    {steps.length > 1 && <button type="button" className="ml-auto text-[11px] text-red-500" onClick={() => removeStep(i)}>Remove</button>}
                  </div>
                  {s.channel === 'whatsapp' ? (
                    <select className="fb-input text-sm w-full" value={s.template_key} onChange={(e) => setStep(i, 'template_key', e.target.value)}>
                      <option value="">Pick an approved WhatsApp template…</option>
                      {waTemplates.map((t) => <option key={t.id} value={t.name}>{t.label} ({t.name})</option>)}
                    </select>
                  ) : (
                    <>
                      <input className="fb-input text-sm w-full" placeholder="Subject — {{first_name}} supported" value={s.subject} onChange={(e) => setStep(i, 'subject', e.target.value)} />
                      <textarea className="fb-input text-sm w-full" rows={3} placeholder="HTML body — {{first_name}}, {{business_name}}, {{booking_link}}…" value={s.body} onChange={(e) => setStep(i, 'body', e.target.value)} />
                    </>
                  )}
                </div>
              ))}
              <button type="button" className="text-[12px] text-[#960D32]" onClick={addStep}>+ Add step</button>
              <p className="text-[10px] adm-t3">WhatsApp steps send with no variables (template-only). Personalise with email steps.</p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Btn variant="outline" size="sm" type="button" onClick={onClose}>Cancel</Btn>
              <Btn size="sm" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create sequence'}</Btn>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
