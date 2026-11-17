// Grow — the destination that does not exist today.
//
// Right now a host's growth tools are scattered: testimonials are a Catalog
// sibling, Refer & Earn is buried in Settings, and reviews received have no page
// at all. Pulled together they answer one question a booking tool must answer:
// "how do I get more people to the page, and more proof on it?"
//
// Everything live is preserved — testimonials CRUD, the referral link and its
// rewards, and the booking page itself.
//
// The measurement half of growth is NOT here. Profile views and the Pro-gated
// funnel moved to Intelligence (nav.js SUBPAGES.intelligence), which answers
// "why are bookings happening or not" with real charts and a server-enforced
// gate. This page used to carry a thinner copy of the same thing; two surfaces
// answering one question is what the IA decision existed to prevent.
import { useState } from 'react';
import {
  CheckCircle2, Copy, Eye, Gift, Link2, MessageSquare, Pencil, Plus, QrCode,
  Quote, Share2, Star, Trash2, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, cn } from '../../../components/dashboard/ui';
import {
  Avatar, Drawer, Field, LabInput, LabTextarea, Panel, Tile,
  SubPageHeader, inr, pct, relDay, useSubPage,
} from '../labUi';
import mock from '../mockData';

/* ── Booking page ──────────────────────────────────────────────────────── */
const BookingPage = () => {
  const url = `meeticulous.com/${mock.host.username}`;
  const CHECKS = mock.setupChecklist;
  const doneCount = CHECKS.filter((c) => c.done).length;

  return (
    <div className="flex flex-col gap-2.5">
      <Panel title="Your link">
        <div className="flex flex-wrap items-center gap-1.5">
          <LabInput readOnly value={url} className="min-w-[220px] flex-1 font-mono text-[11.5px]" aria-label="Your booking page link" />
          <Button onClick={() => { navigator.clipboard?.writeText(`https://${url}`); toast.success('Link copied'); }}>
            <Copy className="h-4 w-4" strokeWidth={2.4} /> Copy
          </Button>
          <Button variant="outline" onClick={() => toast.success('Opens the WhatsApp share sheet')}>
            <MessageSquare className="h-4 w-4" strokeWidth={2.4} /> WhatsApp
          </Button>
          <Button variant="outline" onClick={() => toast.success('QR code downloaded as a PNG')}>
            <QrCode className="h-4 w-4" strokeWidth={2.4} /> QR code
          </Button>
          <Button variant="ghost" onClick={() => toast.success('Opens your public page in a new tab')}>
            <Eye className="h-4 w-4" strokeWidth={2.4} /> Preview
          </Button>
        </div>
      </Panel>

      <Panel title="Make the page work harder" subtitle={`${doneCount} of ${CHECKS.length} done`} flush>
        <div className="px-2.5 pt-2.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-maroon transition-all" style={{ width: `${(doneCount / CHECKS.length) * 100}%` }} />
          </div>
        </div>
        <ul className="mt-2 divide-y-2 divide-neutral-200">
          {CHECKS.map((c) => (
            <li key={c.label} className="flex items-center gap-2 px-2.5 py-1.5">
              <CheckCircle2 className={cn('h-[18px] w-[18px] shrink-0', c.done ? 'text-success-fg' : 'text-neutral-300')} strokeWidth={2.4} />
              <span className={cn('flex-1 text-[11.5px] font-semibold', c.done ? 'text-ink/45 line-through' : 'text-ink')}>{c.label}</span>
              {!c.done && (
                <Button size="sm" variant="outline" onClick={() => toast.success(`Opens: ${c.label}`)}>Do it</Button>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
};

/* ── Social proof ──────────────────────────────────────────────────────── */
const SocialProof = () => {
  const [items, setItems] = useState(mock.testimonials);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ quote: '', author_name: '', author_role: '' });
  const avg = (mock.reviews.reduce((n, r) => n + r.rating, 0) / mock.reviews.length).toFixed(1);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Average rating" value={`${avg}★`} hint={`${mock.reviews.length} reviews`} />
        <Tile label="Awaiting a reply" value={mock.reviews.filter((r) => !r.replied).length} hint="Replying lifts conversion" />
        <Tile label="On your page" value={items.length} hint="Starter plan shows up to 3" />
      </div>

      <Panel
        title="Reviews guests left you"
        subtitle="Public on your booking page"
        action={<Button size="sm" variant="outline" onClick={() => toast.success('Review requests sent to 5 past clients')}>Ask for reviews</Button>}
        flush
      >
        <ul className="divide-y-2 divide-neutral-200">
          {mock.reviews.map((r) => (
            <li key={r.id} className="px-2.5 py-2">
              <div className="flex items-start gap-2">
                <Avatar name={r.author} size="h-8 w-8 text-[10px]" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[12px] font-bold text-ink">{r.author}</p>
                    <span className="text-[11px] font-bold tracking-tight text-maroon" aria-label={`${r.rating} out of 5`}>
                      {'★'.repeat(r.rating)}<span className="text-ink/20">{'★'.repeat(5 - r.rating)}</span>
                    </span>
                    <span className="text-[10.5px] font-semibold text-ink/40">{r.service} · {relDay(r.at)}</span>
                  </div>
                  <p className="mt-1 text-[11.5px] font-medium leading-snug text-ink/75">{r.body}</p>
                  {r.replied ? (
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-bold text-success-fg">
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.4} /> You replied
                    </p>
                  ) : (
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => toast.success(`Reply box opened for ${r.author}`)}>
                      Reply publicly
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Testimonials you added"
        subtitle="Quotes you collected yourself, outside the platform"
        action={<Button size="sm" onClick={() => { setForm({ quote: '', author_name: '', author_role: '' }); setEditing('new'); }}><Plus className="h-4 w-4" strokeWidth={2.6} /> Add quote</Button>}
        flush
      >
        <ul className="divide-y-2 divide-neutral-200">
          {items.map((t) => (
            <li key={t.id} className="flex items-start gap-2 px-2.5 py-2">
              <Quote className="mt-0.5 h-4 w-4 shrink-0 text-maroon/50" strokeWidth={2.4} />
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-medium italic text-ink/80">{t.quote}</p>
                <p className="mt-0.5 text-[10.5px] font-bold text-ink/55">— {t.author_name}, {t.author_role}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => { setForm(t); setEditing(t.id); }} aria-label={`Edit quote from ${t.author_name}`} className="grid h-7 w-7 place-items-center rounded-full text-ink/45 transition hover:bg-blush hover:text-maroon">
                  <Pencil className="h-4 w-4" strokeWidth={2.2} />
                </button>
                <button type="button" onClick={() => { setItems((v) => v.filter((x) => x.id !== t.id)); toast.success('Quote removed'); }} aria-label={`Delete quote from ${t.author_name}`} className="grid h-7 w-7 place-items-center rounded-full text-ink/35 transition hover:bg-error-bg hover:text-error-fg">
                  <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </div>
            </li>
          ))}
          {items.length === 0 && <li className="px-2.5 py-8 text-center text-[11.5px] font-semibold text-ink/45">No quotes yet.</li>}
        </ul>
      </Panel>

      {/* A drawer, not a modal. Three fields do not want a route of their own
          the way a catalog item does, but they do want the lab's one side
          surface rather than the kit dialog everything else here dropped. */}
      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add a testimonial' : 'Edit testimonial'}
        width="sm:w-[420px]"
      >
        <div className="flex flex-col gap-2">
          <Field label="What they said">
            <LabTextarea value={form.quote} onChange={(e) => setForm((f) => ({ ...f, quote: e.target.value }))} placeholder="One or two sentences, in their words." />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Their name">
              <LabInput value={form.author_name} onChange={(e) => setForm((f) => ({ ...f, author_name: e.target.value }))} placeholder="Divya P." />
            </Field>
            <Field label="What they do">
              <LabInput value={form.author_role} onChange={(e) => setForm((f) => ({ ...f, author_role: e.target.value }))} placeholder="Product designer" />
            </Field>
          </div>
          <p className="text-[10.5px] font-medium text-ink/50">Starter plans show three quotes. Pro shows all of them.</p>
          <div className="mt-1 flex gap-1.5">
            <Button
              size="sm"
              disabled={!form.quote.trim() || !form.author_name.trim()}
              onClick={() => {
                if (editing === 'new') setItems((v) => [...v, { ...form, id: `t${Date.now()}` }]);
                else setItems((v) => v.map((x) => (x.id === editing ? { ...form } : x)));
                setEditing(null);
                toast.success('Testimonial saved');
              }}
            >
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
};

/* ── Refer ─────────────────────────────────────────────────────────────── */
const Refer = () => {
  const r = mock.referrals;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile label="Invited" value={r.invited} />
        <Tile label="Went live" value={r.joined} />
        <Tile label="Earned" value={inr(r.earned)} />
        <Tile label="Pending" value={inr(r.pending)} hint="Paid once they take a booking" />
      </div>

      <Panel title="Your invite link">
        <div className="flex flex-wrap items-center gap-1.5">
          <LabInput readOnly value={r.link} className="min-w-[220px] flex-1 font-mono text-[11.5px]" aria-label="Your invite link" />
          <Button onClick={() => { navigator.clipboard?.writeText(`https://${r.link}`); toast.success('Invite link copied'); }}>
            <Copy className="h-4 w-4" strokeWidth={2.4} /> Copy
          </Button>
          <Button variant="outline" onClick={() => toast.success('Opens the WhatsApp share sheet')}>
            <Share2 className="h-4 w-4" strokeWidth={2.4} /> Share
          </Button>
        </div>
        <ul className="mt-2.5 flex flex-col gap-1.5 text-[11.5px] font-medium text-ink/70">
          {[
            ['They sign up with your link', Link2],
            ['They publish a service and take a booking', Users],
            ['₹500 to each of you', Gift],
          ].map(([t, Icon], i) => (
            <li key={t} className="flex items-center gap-1.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blush text-[10px] font-bold text-maroon">{i + 1}</span>
              <Icon className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={2.2} />
              {t}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
};

/* ── Page ──────────────────────────────────────────────────────────────── */
const Grow = () => {
  const page = useSubPage('grow');

  return (
    <div className="flex flex-col gap-2.5">
      <SubPageHeader
        page={page}
        action={(
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blush px-2.5 py-1.5 text-[10.5px] font-bold text-maroon">
            <Star className="h-3.5 w-3.5" strokeWidth={2.4} /> {(mock.reviews.reduce((n, x) => n + x.rating, 0) / mock.reviews.length).toFixed(1)} average ·
            {' '}{mock.funnel.views.toLocaleString('en-IN')} views · {pct(mock.funnel.completed / mock.funnel.views)} booked
          </span>
        )}
      />

      {page.slug === 'page' && <BookingPage />}
      {page.slug === 'proof' && <SocialProof />}
      {page.slug === 'refer' && <Refer />}
    </div>
  );
};

export default Grow;
