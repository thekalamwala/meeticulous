// The follow-up window: pick one message, send it by WhatsApp and/or email.
// Opens after a call is saved (pre-picked for the outcome) or from Communicate.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Btn } from '../../../components/admin/ui';
import { crmColdCallSend, crmUpdateTemplate } from '../../../services/api';
import { HEADING } from './ccUi';
import { MESSAGE_SETS, previewText, sendResultMessage, formatPhone, outcomeLabel } from './coldCallUtils';

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const whenText = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
const initials = (s) => String(s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const WaIcon = () => (
  <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#25D366" />
    <path d="M10.5 22.5l1-3.4a7.3 7.3 0 1 1 2.8 2.6l-3.8.8z" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" /></svg>
);
const MailIcon = () => (
  <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="7" width="26" height="18" rx="3" fill="#EA4335" opacity=".12" />
    <path d="M5 10l11 8 11-8" fill="none" stroke="#EA4335" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="4" y="8" width="24" height="16" rx="2.5" fill="none" stroke="#4285F4" strokeWidth="1.6" /></svg>
);

function Pill({ tone, children, onClick, open }) {
  const cls = { ok: 'bg-emerald-500/10 text-emerald-700', warn: 'bg-amber-500/10 text-amber-700', off: 'adm-chip adm-t3' }[tone];
  const dot = { ok: 'bg-emerald-500', warn: 'bg-amber-500', off: 'bg-gray-400' }[tone];
  return (
    <button type="button" onClick={onClick} aria-expanded={open} title="Show the message"
      className={`!min-h-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap ${cls}`}>
      <span className={`w-2 h-2 rounded-full ${dot}`} />{children}<span className={`transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
    </button>
  );
}

export default function ColdCallCommunicate({ lead, templates, initialCategory, callbackAt, savedOutcome, afterSave, onClose, onDone, onTemplatesChanged }) {
  const [category, setCategory] = useState(initialCategory);
  const [toEmail, setToEmail] = useState(lead.email || '');
  const [open, setOpen] = useState(null);           // which channel's message is expanded
  const [busy, setBusy] = useState(false);
  const emailTpl = templates.find((t) => t.channel === 'email' && t.category === category);
  const waTpl = templates.find((t) => t.channel === 'whatsapp' && t.category === category);
  const emailOk = VALID_EMAIL.test(toEmail.trim());
  const waOk = /\d{10}/.test(String(lead.whatsapp_phone || lead.phone || '').replace(/\D/g, ''));
  const waReady = !!(waTpl?.is_active && waOk);
  const emailReady = !!(emailTpl?.is_active && emailOk);
  const [sendWa, setSendWa] = useState(waReady);
  const [sendEmail, setSendEmail] = useState(emailReady);

  // A different message re-ticks whatever is ready for it.
  useEffect(() => { setSendWa(waReady); setSendEmail(emailReady); }, [category]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const business = lead.business_name || lead.name || '';
  const ctx = { business, callbackTime: whenText(callbackAt) };
  const count = (sendEmail && emailReady ? 1 : 0) + (sendWa && waReady ? 1 : 0);
  const options = MESSAGE_SETS.filter((m) => templates.some((t) => t.category === m.category));

  const approve = async () => {
    try { await crmUpdateTemplate(waTpl.id, { is_active: true }); toast.success('Marked approved'); onTemplatesChanged?.(); }
    catch (e) { toast.error(e.response?.data?.message || 'Could not update template'); }
  };

  const send = async () => {
    if (!count || busy) return;
    setBusy(true);
    try {
      const { data } = await crmColdCallSend(lead.id, {
        email: sendEmail && emailReady ? { category } : null,
        whatsapp: sendWa && waReady ? { category } : null,
        callbackAt: callbackAt || null,
        toEmail: sendEmail && toEmail.trim() !== (lead.email || '') ? toEmail.trim() : undefined,
      });
      for (const [ch, r] of Object.entries(data?.sends || {})) {
        const m = sendResultMessage(ch, r);
        if (m.kind === 'success') toast.success(m.text); else if (m.kind === 'info') toast(m.text); else toast.error(m.text);
      }
      onDone(afterSave);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not send');
    } finally { setBusy(false); }
  };

  const channelCard = ({ key, title, icon, ready, checked, setChecked, to, pill }) => (
    <div className={`rounded-2xl border p-4 flex items-center gap-3 ${checked && ready ? 'border-[#960D32]/30' : 'adm-border'}`}>
      <input type="checkbox" aria-label={`Send ${title}`} className="!w-5 !h-5 !min-h-0 !p-0 accent-[#960D32] shrink-0" checked={checked && ready} disabled={!ready}
        onChange={(e) => setChecked(e.target.checked)} />
      {icon}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold adm-t1" style={HEADING}>{title}</div>
        <div className="text-[13px] adm-t3 truncate">{to}</div>
      </div>
      {pill}
    </div>
  );

  // Tracked-link params ({ ref }) are the lead's own invite code / link, filled at send.
  const waBody = (waTpl?.variables || []).reduce((body, v, i) => (v.ref
    ? body.replace(new RegExp(`\\{\\{\\s*${i + 1}\\s*\\}\\}`, 'g'), v.ref === 'link' ? 'https://meeticulous.com/for/<their category>?i=CODE' : 'CODE')
    : body), String(waTpl?.body || ''));
  const preview = open === 'whatsapp' ? previewText(waBody, ctx)
    : open === 'email' && emailTpl ? `${previewText(emailTpl.subject, ctx)}\n\n${previewText(emailTpl.body, ctx)}` : '';

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/45 p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Send follow-up">
      <div className="adm-card rounded-2xl w-full max-w-[740px] shadow-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[22px] font-bold adm-t1" style={HEADING}>Send follow-up to this lead</h2>
            <p className="text-[13.5px] adm-t3">Choose a template and send it via WhatsApp or Email.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="!min-h-0 text-[22px] adm-t3 hover:adm-t1 leading-none">✕</button>
        </div>

        <div className="rounded-2xl adm-chip p-4 flex items-center gap-4">
          <span className="w-14 h-14 rounded-full bg-[#960D32]/15 text-[#960D32] font-bold text-[18px] flex items-center justify-center shrink-0" style={HEADING}>{initials(business)}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-bold adm-t1 truncate" style={HEADING}>{business || 'This lead'}</div>
            <div className="text-[13px] adm-t3 truncate">{formatPhone(lead.phone)}{toEmail ? ` · ${toEmail}` : ''}</div>
          </div>
          {savedOutcome && <span className="shrink-0 rounded-xl border border-[#960D32]/40 bg-[#960D32]/10 text-[#c2410c] px-3 py-1.5 text-[13px] font-semibold">{outcomeLabel(savedOutcome)}</span>}
        </div>

        <label className="block">
          <span className="text-[14px] font-bold adm-t1" style={HEADING}>Template</span>
          <select className="fb-input !w-full mt-2" value={category} onChange={(e) => { setCategory(e.target.value); setOpen(null); }} aria-label="Template">
            {options.map((m) => <option key={m.category} value={m.category}>{m.label}</option>)}
          </select>
        </label>

        <div>
          <div className="text-[14px] font-bold adm-t1 mb-2" style={HEADING}>Send via</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {channelCard({
              key: 'whatsapp', title: 'WhatsApp', icon: <WaIcon />, ready: waReady, checked: sendWa, setChecked: setSendWa,
              to: formatPhone(lead.whatsapp_phone || lead.phone),
              pill: !waTpl ? <Pill tone="off" open={false}>No template</Pill>
                : !waTpl.is_active ? <Pill tone="warn" open={open === 'whatsapp'} onClick={() => setOpen(open === 'whatsapp' ? null : 'whatsapp')}>Pending</Pill>
                  : <Pill tone={waOk ? 'ok' : 'off'} open={open === 'whatsapp'} onClick={() => setOpen(open === 'whatsapp' ? null : 'whatsapp')}>{waOk ? 'Ready' : 'No number'}</Pill>,
            })}
            {channelCard({
              key: 'email', title: 'Email', icon: <MailIcon />, ready: emailReady, checked: sendEmail, setChecked: setSendEmail,
              to: lead.email ? toEmail : (
                <input className="fb-input text-[13px] !w-full !min-h-0 !py-1 mt-0.5" type="email" placeholder="Type their email" value={toEmail}
                  onChange={(e) => { setToEmail(e.target.value); if (VALID_EMAIL.test(e.target.value.trim())) setSendEmail(true); }} />
              ),
              pill: !emailTpl ? <Pill tone="off" open={false}>No template</Pill>
                : <Pill tone={emailOk ? 'ok' : 'off'} open={open === 'email'} onClick={() => setOpen(open === 'email' ? null : 'email')}>{emailOk ? 'Ready' : 'Add email'}</Pill>,
            })}
          </div>
          {waTpl && !waTpl.is_active && (
            <div className="text-[12px] adm-t3 mt-2">WhatsApp sends once Meta approves this template. Approved already? <button type="button" className="!min-h-0 font-semibold text-[#960D32]" onClick={approve}>Mark approved</button></div>
          )}
          {preview && <div className={`mt-3 rounded-xl p-3 text-[13px] leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto ${open === 'whatsapp' ? 'bg-[#e7f8e1] text-[#111827]' : 'border adm-border adm-t2'}`}>{preview}</div>}
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-4 border-t adm-border">
          <span className="text-[#960D32] text-[20px]">⚡</span>
          <span className="text-[12.5px] adm-t3 flex-1 min-w-[200px]">Sends now (you just spoke, so quiet hours don't apply). Logged to the lead.</span>
          <Btn variant="outline" onClick={() => onDone(afterSave)}>{afterSave ? 'Skip' : 'Cancel'}</Btn>
          <Btn disabled={!count || busy} onClick={send}>{busy ? 'Sending…' : 'Send follow-up'}</Btn>
        </div>
      </div>
    </div>
  );
}
