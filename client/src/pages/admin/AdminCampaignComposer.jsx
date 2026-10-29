/**
 * AdminCampaignComposer — visual email composer with live preview.
 *
 * Left: campaign meta (name/subject/preview/sender/segment) + a block editor.
 * Right: device-toggled iframe showing the ACTUAL compiled email HTML (server
 * compiles the same block model that gets sent — the preview is real, not a mock).
 *
 * Phase 2: compose + preview + save draft. Test-send and the send/confirm flow
 * arrive in Phase 4; recipient list + manual/single audience in Phase 3.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { adminCampSegments, adminCampSegPreview, adminCampPreview, adminCampCreate, adminUploadImage, adminCampContacts, adminCampResolveAudience, adminCampTest } from '../../services/api';
import { Card, Btn } from '../../components/admin/ui';

// Palette: block type → factory for a fresh block.
const NEW_BLOCK = {
  heading: () => ({ type: 'heading', text: 'Heading', level: 2, align: 'left' }),
  text:    () => ({ type: 'text', text: 'Write something to your audience…', align: 'left' }),
  image:   () => ({ type: 'image', src: '', href: '', alt: '', width: 600 }),
  button:  () => ({ type: 'button', label: 'View', href: 'https://meeticulous.com', align: 'left' }),
  divider: () => ({ type: 'divider' }),
  spacer:  () => ({ type: 'spacer', size: 16 }),
  // Founder-voice blocks (ported from the design catalog).
  metric:      () => ({ type: 'metric', value: '78 hosts', label: 'now on Meeticulous' }),
  callout:     () => ({ type: 'callout', text: 'The one thing I want you to take away…', background: '#fff4ed' }),
  checklist:   () => ({ type: 'checklist', items: ['First point', 'Second point'], columns: 1 }),
  beforeAfter: () => ({ type: 'beforeAfter', beforeTitle: 'Before', before: 'Chasing payments\nManual reminders', afterTitle: 'After', after: 'Auto-paid\nCalm inbox' }),
  caseCard:    () => ({ type: 'caseCard', name: 'A host in Pune', text: 'Doubled bookings in 60 days.' }),
  quote:       () => ({ type: 'quote', text: 'You never chase payment.', author: 'Shubham' }),
  editorial:   () => ({ type: 'editorial', eyebrow: 'From the desk of Shubham', heading: 'A short note', body: 'Write the story here…' }),
};
const PALETTE = ['heading', 'text', 'image', 'button', 'divider', 'spacer',
  'metric', 'callout', 'checklist', 'beforeAfter', 'caseCard', 'quote', 'editorial'];

// Ready-made founder-voice layouts. Picking one replaces the block list; blocks
// are deep-cloned on load so edits never mutate these constants.
const STARTER_DESIGNS = [
  { name: 'Founder note', blocks: [
    { type: 'editorial', eyebrow: 'From the desk of Shubham', heading: 'Why I built Meeticulous',
      body: 'I got tired of watching good people spend their evenings chasing payments and juggling DMs instead of doing the work they love. So we built the calm way to sell your time — where the admin runs itself and you never chase a payment again.' },
    { type: 'quote', text: 'You should never have to chase a payment again.', author: 'Shubham', align: 'center' },
    { type: 'button', label: "See what's new", href: 'https://meeticulous.com', align: 'left' },
  ] },
  { name: 'Milestone', blocks: [
    { type: 'heading', text: 'A quick milestone worth sharing', level: 1, align: 'left' },
    { type: 'metric', value: '78 hosts', label: 'now run their bookings on Meeticulous' },
    { type: 'text', text: "When we started, the goal was simple: give you a calm way to sell your time. Here's where that's gotten us — and where we're headed next.", align: 'left' },
    { type: 'checklist', items: ['Instant payouts, no chasing', 'Automatic reminders', 'One link for everything you offer'], columns: 1 },
    { type: 'button', label: 'Explore your dashboard', href: 'https://meeticulous.com/dashboard', align: 'left' },
  ] },
  { name: 'Re-engage a quiet host', blocks: [
    { type: 'heading', text: "Your calendar's been quiet — let's fix that", level: 2, align: 'left' },
    { type: 'text', text: "It's been a while since your last booking. A few small changes usually make the difference.", align: 'left' },
    { type: 'beforeAfter', beforeTitle: 'Now', before: 'Empty slots\nManual follow-ups', afterTitle: 'After a tune-up', after: 'Steady bookings\nAuto reminders' },
    { type: 'caseCard', name: 'A host in Pune', text: 'Refreshed her page and doubled bookings in 60 days.' },
    { type: 'button', label: 'Tune up my page', href: 'https://meeticulous.com/dashboard', align: 'left' },
  ] },
];

const Field = ({ label, children }) => (
  <div><label className="block text-xs font-semibold adm-t3 mb-1">{label}</label>{children}</div>
);
const AlignPicker = ({ value, onChange }) => (
  <select className="fb-input text-sm" value={value || 'left'} onChange={(e) => onChange(e.target.value)}>
    <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
  </select>
);

const BlockEditor = ({ block, onChange, onUpload }) => {
  const set = (patch) => onChange({ ...block, ...patch });
  switch (block.type) {
    case 'heading':
      return (
        <div className="space-y-2">
          <input className="fb-input text-sm" value={block.text} onChange={(e) => set({ text: e.target.value })} placeholder="Heading text" />
          <div className="grid grid-cols-2 gap-2">
            <select className="fb-input text-sm" value={block.level} onChange={(e) => set({ level: +e.target.value })}>
              <option value={1}>Large</option><option value={2}>Medium</option><option value={3}>Small</option>
            </select>
            <AlignPicker value={block.align} onChange={(align) => set({ align })} />
          </div>
        </div>
      );
    case 'text':
      return (
        <div className="space-y-2">
          <textarea className="fb-input text-sm font-sans" rows={4} value={block.text} onChange={(e) => set({ text: e.target.value })} placeholder="Body text — {{first_name}} is personalized per recipient" />
          <AlignPicker value={block.align} onChange={(align) => set({ align })} />
        </div>
      );
    case 'image':
      return (
        <div className="space-y-2">
          {block.src ? <img src={block.src} alt="" className="max-h-28 rounded border adm-border" /> : null}
          <div className="flex gap-2 items-center">
            <label className="text-xs adm-t2 cursor-pointer underline">
              Upload
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0], (url) => set({ src: url }))} />
            </label>
            <input className="fb-input text-sm flex-1" value={block.src} onChange={(e) => set({ src: e.target.value })} placeholder="or paste https:// image URL" />
          </div>
          <input className="fb-input text-sm" value={block.href} onChange={(e) => set({ href: e.target.value })} placeholder="Link URL (optional)" />
          <div className="grid grid-cols-2 gap-2">
            <input className="fb-input text-sm" value={block.alt} onChange={(e) => set({ alt: e.target.value })} placeholder="Alt text" />
            <input className="fb-input text-sm" type="number" value={block.width} onChange={(e) => set({ width: +e.target.value })} placeholder="Width px" />
          </div>
        </div>
      );
    case 'button':
      return (
        <div className="space-y-2">
          <input className="fb-input text-sm" value={block.label} onChange={(e) => set({ label: e.target.value })} placeholder="Button label" />
          <input className="fb-input text-sm" value={block.href} onChange={(e) => set({ href: e.target.value })} placeholder="Button URL" />
          <AlignPicker value={block.align} onChange={(align) => set({ align })} />
        </div>
      );
    case 'spacer':
      return <input className="fb-input text-sm" type="number" value={block.size} onChange={(e) => set({ size: +e.target.value })} placeholder="Height px" />;
    case 'divider':
      return <p className="text-xs adm-t3">Horizontal divider.</p>;
    case 'metric':
      return (
        <div className="space-y-2">
          <input className="fb-input text-sm" value={block.value} onChange={(e) => set({ value: e.target.value })} placeholder="Big number — e.g. 3,200 hosts" />
          <input className="fb-input text-sm" value={block.label} onChange={(e) => set({ label: e.target.value })} placeholder="Caption under the number" />
        </div>
      );
    case 'callout':
      return (
        <div className="space-y-2">
          <textarea className="fb-input text-sm font-sans" rows={3} value={block.text} onChange={(e) => set({ text: e.target.value })} placeholder="Key insight — stands out with a colored bar" />
          <input className="fb-input text-sm" value={block.background || ''} onChange={(e) => set({ background: e.target.value })} placeholder="Background hex (optional, e.g. #fff4ed)" />
        </div>
      );
    case 'checklist':
      return (
        <div className="space-y-2">
          <textarea className="fb-input text-sm font-sans" rows={4}
            value={(block.items || []).join('\n')}
            onChange={(e) => set({ items: e.target.value.split('\n') })}
            placeholder="One item per line — each gets a ✔" />
          <select className="fb-input text-sm" value={block.columns || 1} onChange={(e) => set({ columns: +e.target.value })}>
            <option value={1}>One column</option><option value={2}>Two columns</option>
          </select>
        </div>
      );
    case 'beforeAfter':
      return (
        <div className="grid grid-cols-2 gap-2">
          <input className="fb-input text-sm" value={block.beforeTitle} onChange={(e) => set({ beforeTitle: e.target.value })} placeholder="Left title" />
          <input className="fb-input text-sm" value={block.afterTitle} onChange={(e) => set({ afterTitle: e.target.value })} placeholder="Right title" />
          <textarea className="fb-input text-sm font-sans" rows={3} value={block.before} onChange={(e) => set({ before: e.target.value })} placeholder="Left body (one line each)" />
          <textarea className="fb-input text-sm font-sans" rows={3} value={block.after} onChange={(e) => set({ after: e.target.value })} placeholder="Right body (one line each)" />
        </div>
      );
    case 'caseCard':
      return (
        <div className="space-y-2">
          <input className="fb-input text-sm" value={block.name} onChange={(e) => set({ name: e.target.value })} placeholder="Who — e.g. A host in Pune" />
          <textarea className="fb-input text-sm font-sans" rows={3} value={block.text} onChange={(e) => set({ text: e.target.value })} placeholder="What happened" />
        </div>
      );
    case 'quote':
      return (
        <div className="space-y-2">
          <textarea className="fb-input text-sm font-sans" rows={3} value={block.text} onChange={(e) => set({ text: e.target.value })} placeholder="The line worth remembering" />
          <div className="grid grid-cols-2 gap-2">
            <input className="fb-input text-sm" value={block.author} onChange={(e) => set({ author: e.target.value })} placeholder="Attribution" />
            <AlignPicker value={block.align} onChange={(align) => set({ align })} />
          </div>
        </div>
      );
    case 'editorial':
      return (
        <div className="space-y-2">
          <input className="fb-input text-sm" value={block.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} placeholder="Eyebrow — e.g. From the desk of Shubham" />
          <input className="fb-input text-sm" value={block.heading} onChange={(e) => set({ heading: e.target.value })} placeholder="Heading" />
          <textarea className="fb-input text-sm font-sans" rows={5} value={block.body} onChange={(e) => set({ body: e.target.value })} placeholder="Editorial paragraph" />
        </div>
      );
    default:
      return null;
  }
};

const AdminCampaignComposer = ({ onClose }) => {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [audience, setAudience] = useState('customer'); // shell: customer|vendor
  const [audMode, setAudMode] = useState('segment'); // segment | people
  const [segmentId, setSegmentId] = useState('');
  const [segments, setSegments] = useState([]);
  const [count, setCount] = useState(null);
  // Manual/single picker
  const [peopleQuery, setPeopleQuery] = useState('');
  const [peopleResults, setPeopleResults] = useState([]);
  const [selected, setSelected] = useState([]); // [{id,name,email}]
  // View-recipients modal
  const [viewing, setViewing] = useState(false);
  const [recips, setRecips] = useState(null); // {count,recipients,truncated}
  const [blocks, setBlocks] = useState([NEW_BLOCK.heading(), NEW_BLOCK.text()]);
  const [device, setDevice] = useState('desktop');
  const [html, setHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewErr, setPreviewErr] = useState(false);
  // Test send
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => { adminCampSegments().then((r) => setSegments(r.data)).catch(() => {}); }, []);

  const previewCount = async (segId) => {
    const seg = segments.find((s) => s.id === segId);
    if (!seg) return setCount(null);
    try { const r = await adminCampSegPreview(seg.definition, 'email'); setCount(r.data.count); } catch { setCount(null); }
  };

  // Manual/single audience → audience_type + audience_ref, or a segment.
  const audiencePayload = () => {
    if (audMode === 'people') {
      return { audience_type: selected.length === 1 ? 'single' : 'manual', audience_ref: { contact_ids: selected.map((p) => p.id) } };
    }
    return { audience_type: 'segment', definition: segments.find((s) => s.id === segmentId)?.definition || {} };
  };

  const searchPeople = async (q) => {
    setPeopleQuery(q);
    if (q.trim().length < 2) return setPeopleResults([]);
    try { const r = await adminCampContacts({ search: q, limit: 20 }); setPeopleResults(r.data || []); } catch { setPeopleResults([]); }
  };
  const addPerson = (c) => setSelected((s) => (s.find((p) => p.id === c.id) ? s : [...s, { id: c.id, name: c.name, email: c.email }]));
  const removePerson = (id) => setSelected((s) => s.filter((p) => p.id !== id));

  const viewRecipients = async () => {
    setViewing(true); setRecips(null);
    try {
      const p = audiencePayload();
      const r = await adminCampResolveAudience({ ...p, channel: 'email' });
      setRecips(r.data);
    } catch { setRecips({ count: 0, recipients: [] }); }
  };

  // Debounced live preview: server compiles the exact block model we'll send.
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await adminCampPreview({ design_json: { blocks }, subject, preview_text: previewText, audience });
        setHtml(r.data.html); setPreviewErr(false);
      } catch { setPreviewErr(true); }
    }, 500);
    return () => clearTimeout(timer.current);
  }, [blocks, subject, previewText, audience]);

  const upload = useCallback(async (file, done) => {
    try { const r = await adminUploadImage(file, 'email'); done(r.data.url); toast.success('Image uploaded'); }
    catch { toast.error('Upload failed'); }
  }, []);

  const loadStarter = (idx) => {
    const d = STARTER_DESIGNS[idx];
    if (!d) return;
    if (blocks.length && !window.confirm('Replace the current blocks with this layout?')) return;
    setBlocks(JSON.parse(JSON.stringify(d.blocks)));
  };
  const addBlock = (type) => setBlocks((b) => [...b, NEW_BLOCK[type]()]);
  const patchBlock = (i, nb) => setBlocks((b) => b.map((x, j) => (j === i ? nb : x)));
  const removeBlock = (i) => setBlocks((b) => b.filter((_, j) => j !== i));
  const move = (i, d) => setBlocks((b) => {
    const j = i + d; if (j < 0 || j >= b.length) return b;
    const copy = [...b]; [copy[i], copy[j]] = [copy[j], copy[i]]; return copy;
  });

  const sendTest = async () => {
    if (!blocks.length) return toast.error('Add at least one content block');
    setTesting(true);
    try {
      const r = await adminCampTest({
        design_json: { blocks }, subject, preview_text: previewText, audience,
        to: testEmail.trim() || undefined, // backend defaults to the admin's own email
      });
      toast.success(`Test sent to ${r.data.to}`);
    } catch (e) { toast.error(e?.response?.data?.message || 'Test send failed'); }
    finally { setTesting(false); }
  };

  const saveDraft = async () => {
    if (!name.trim()) return toast.error('Campaign name is required');
    if (!subject.trim()) return toast.error('Subject is required');
    if (!blocks.length) return toast.error('Add at least one content block');
    setSaving(true);
    try {
      const aud = audMode === 'people'
        ? { audience_type: selected.length === 1 ? 'single' : 'manual', audience_ref: { contact_ids: selected.map((p) => p.id) }, segment_id: null }
        : { audience_type: 'segment', segment_id: segmentId || null };
      await adminCampCreate({
        name, channel: 'email', ...aud,
        subject, preview_text: previewText, sender_key: 'shubham',
        design_json: { blocks }, throttle_per_min: 120, layout: audience,
      });
      toast.success('Draft saved');
      onClose?.();
    } catch (e) { toast.error(e?.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold adm-t1">Create Email</h1>
          <p className="text-xs adm-t3">From Shubham · Founder &lt;shubham@meeticulous.in&gt;</p>
        </div>
        <div className="flex items-center gap-2">
          <input className="fb-input text-sm w-52" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test to (your email)" />
          <Btn variant="outline" size="sm" onClick={sendTest} disabled={testing}>{testing ? 'Sending…' : 'Send test'}</Btn>
          <Btn variant="outline" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" onClick={saveDraft} disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</Btn>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Editor ── */}
        <div className="space-y-3">
          <Card className="space-y-3">
            <Field label="Campaign name (internal)"><input className="fb-input text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. August host update" /></Field>
            <Field label="Subject"><input className="fb-input text-sm" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Inbox subject line" /></Field>
            <Field label="Preview text (inbox preheader)"><input className="fb-input text-sm" value={previewText} onChange={(e) => setPreviewText(e.target.value)} placeholder="Shown after the subject in most inboxes" /></Field>
            <Field label="Layout">
              <select className="fb-input text-sm" value={audience} onChange={(e) => setAudience(e.target.value)}>
                <option value="customer">Guest (branded footer)</option>
                <option value="vendor">Host (minimal footer)</option>
                <option value="cold">Cold outreach (no header, plain)</option>
              </select>
            </Field>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold adm-t1">Recipients</p>
              <div className="flex gap-1">
                {[['segment', 'Segment'], ['people', 'Pick people']].map(([m, label]) => (
                  <button key={m} onClick={() => setAudMode(m)}
                    className={`text-[11px] px-2.5 py-1 rounded border ${audMode === m ? 'bg-indigo-600 text-white border-indigo-600' : 'adm-border adm-t2 adm-hoverable'}`}>{label}</button>
                ))}
              </div>
            </div>

            {audMode === 'segment' ? (
              <>
                <select className="fb-input text-sm" value={segmentId} onChange={(e) => { setSegmentId(e.target.value); previewCount(e.target.value); }}>
                  <option value="">Select a segment…</option>
                  {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {count !== null && <p className="text-[11px] adm-t2">≈ {count} consented email recipients</p>}
              </>
            ) : (
              <>
                <input className="fb-input text-sm" value={peopleQuery} onChange={(e) => searchPeople(e.target.value)} placeholder="Search name, email, or phone…" />
                {peopleResults.length > 0 && (
                  <div className="border adm-border rounded-lg max-h-40 overflow-auto divide-y adm-border">
                    {peopleResults.map((c) => (
                      <button key={c.id} onClick={() => addPerson(c)} className="block w-full text-left px-3 py-1.5 text-xs adm-hoverable">
                        <span className="font-medium adm-t1">{c.name || '—'}</span> <span className="adm-t3">{c.email || c.phone}</span>
                        <span className="adm-t3 ml-1">· {c.contact_type}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selected.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5">
                        {p.name || p.email}
                        <button onClick={() => removePerson(p.id)} className="font-bold">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[11px] adm-t2">{selected.length} selected · opted-out contacts are dropped at send</p>
              </>
            )}

            <button onClick={viewRecipients}
              disabled={audMode === 'segment' ? !segmentId : selected.length === 0}
              className="text-xs text-indigo-600 font-semibold hover:underline disabled:opacity-40 disabled:no-underline">View recipients</button>
          </Card>

          <Card className="space-y-2">
            <Field label="Start from a layout (optional)">
              <select className="fb-input text-sm" value="" onChange={(e) => { if (e.target.value !== '') loadStarter(+e.target.value); }}>
                <option value="">Blank — build your own</option>
                {STARTER_DESIGNS.map((d, i) => <option key={d.name} value={i}>{d.name}</option>)}
              </select>
            </Field>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold adm-t1">Content blocks</p>
              <div className="flex flex-wrap gap-1">
                {PALETTE.map((t) => <button key={t} onClick={() => addBlock(t)} className="text-[11px] px-2 py-1 rounded border adm-border adm-hoverable capitalize adm-t2">+ {t}</button>)}
              </div>
            </div>
            {blocks.map((b, i) => (
              <div key={i} className="border adm-border rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide adm-t3 capitalize">{b.type}</span>
                  <div className="flex gap-1 text-xs adm-t3">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="px-1 disabled:opacity-30">↑</button>
                    <button onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="px-1 disabled:opacity-30">↓</button>
                    <button onClick={() => removeBlock(i)} className="px-1 text-red-500">✕</button>
                  </div>
                </div>
                <BlockEditor block={b} onChange={(nb) => patchBlock(i, nb)} onUpload={upload} />
              </div>
            ))}
            {blocks.length === 0 && <p className="text-xs adm-t3 py-3 text-center">No blocks yet — add one above.</p>}
          </Card>
        </div>

        {/* ── Preview ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold adm-t1">Live preview</p>
            <div className="flex gap-1">
              {['desktop', 'mobile'].map((d) => (
                <button key={d} onClick={() => setDevice(d)}
                  className={`text-[11px] px-2.5 py-1 rounded border capitalize ${device === d ? 'bg-indigo-600 text-white border-indigo-600' : 'adm-border adm-t2 adm-hoverable'}`}>{d}</button>
              ))}
            </div>
          </div>
          <div className="adm-card rounded-xl p-3 flex justify-center overflow-auto" style={{ minHeight: 480 }}>
            {previewErr
              ? <p className="text-xs text-red-500 self-center">Preview failed to render.</p>
              : (
                <iframe title="Email preview" srcDoc={html} sandbox=""
                  style={{ width: device === 'mobile' ? 375 : '100%', maxWidth: device === 'mobile' ? 375 : 640, height: 620, border: '1px solid var(--adm-border,#edf0f2)', borderRadius: 8, background: '#fff' }} />
              )}
          </div>
          <p className="text-[11px] adm-t3 mt-2">Approximate — real inboxes (Gmail, Outlook, Apple Mail) vary slightly. Send a test before launching.</p>
        </div>
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewing(false)}>
          <div className="adm-card rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b adm-border">
              <p className="text-sm font-semibold adm-t1">Recipients{recips ? ` · ${recips.count}` : ''}</p>
              <button onClick={() => setViewing(false)} className="adm-t3 text-lg leading-none">×</button>
            </div>
            <div className="overflow-auto">
              {!recips ? <p className="text-xs adm-t3 p-4">Loading…</p> : (
                <table className="w-full text-xs">
                  <thead><tr className="text-left uppercase tracking-wide adm-t3 border-b adm-border">
                    <th className="px-4 py-2">Name</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Type</th>
                  </tr></thead>
                  <tbody>
                    {recips.recipients.map((r) => (
                      <tr key={r.id} className="border-b adm-border last:border-0">
                        <td className="px-4 py-1.5 adm-t1">{r.name || '—'}</td>
                        <td className="px-4 py-1.5 adm-t2">{r.email}</td>
                        <td className="px-4 py-1.5 adm-t3 capitalize">{r.contact_type}</td>
                      </tr>
                    ))}
                    {recips.recipients.length === 0 && <tr><td colSpan="3" className="px-4 py-6 text-center adm-t3">No consented recipients.</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
            {recips?.truncated && <p className="text-[11px] adm-t3 px-4 py-2 border-t adm-border">Showing first 1000.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCampaignComposer;
