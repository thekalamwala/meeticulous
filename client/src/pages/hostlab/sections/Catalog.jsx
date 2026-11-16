// Catalog — everything a host sells, in one place.
//
// Today these are four separate rail items (Services, Products, Courses,
// Memberships) plus Coupons, each a page of its own. They are the same job:
// "what am I selling, for how much, and is it working?" So they become tabs of
// one destination, and every row carries its own 30-day performance — the number
// that tells a host which service to push and which to retire. Nothing is lost:
// each tab is the live page, and the service editor keeps every field.
import { useMemo, useState } from 'react';
import {
  BarChart3, BookOpen, Copy, Eye, EyeOff, FileDown, Package, Pencil, Plus,
  Sparkles, Ticket, Trash2, Clock, Users, IndianRupee, Share2,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button, Modal, Tabs, cn } from '../../../components/dashboard/ui';
import { Field, LabInput, LabSelect, LabTextarea, Panel, StatusPill, Toggle, fmtDayFull, inr, pct } from '../labUi';
import mock from '../mockData';

/* ── Service editor — the live ServiceForm's fields, reorganised ───────── */
const ServiceEditor = ({ service, onClose }) => {
  const [form, setForm] = useState(
    service || { title: '', duration: 30, price: '', description: '', kind: 'session', active: true, price_on_request: false },
  );
  const [step, setStep] = useState('basics');
  const valid = form.title.trim().length > 2 && form.duration > 0;

  const STEPS = [
    { value: 'basics', label: 'The basics' },
    { value: 'price', label: 'Price' },
    { value: 'page', label: 'Booking page' },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={service ? `Edit ${service.title}` : 'New service'}
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid} onClick={() => { toast.success(service ? `${form.title} saved` : `${form.title} created`); onClose(); }}>
            {service ? 'Save changes' : 'Create service'}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <Tabs tabs={STEPS} value={step} onChange={setStep} />

        {step === 'basics' && (
          <div className="flex flex-col gap-3.5">
            <Field label="What is it called?" hint="Guests see this on your booking page.">
              <LabInput value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Nutrition deep-dive" />
            </Field>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="How long?">
                <LabSelect value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: +e.target.value }))}>
                  {[15, 20, 30, 45, 60, 75, 90, 120].map((n) => <option key={n} value={n}>{n} minutes</option>)}
                </LabSelect>
              </Field>
              <Field label="Kind">
                <LabSelect value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
                  <option value="session">One-to-one session</option>
                  <option value="group">Group session</option>
                  <option value="package">Package of sessions</option>
                </LabSelect>
              </Field>
            </div>
            <Field label="Describe it" hint="Two or three sentences. What the guest walks away with.">
              <LabTextarea rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
            <button
              type="button"
              onClick={() => { setForm((f) => ({ ...f, description: 'A full look at your diet history and recent bloodwork, then a four-week plan you can actually cook. You leave with a grocery list and a follow-up date.' })); toast.success('Draft written — edit it to sound like you'); }}
              className="inline-flex w-fit items-center gap-1.5 rounded-full border-2 border-maroon px-3 py-1.5 text-[12.5px] font-bold text-maroon transition hover:bg-pink-100"
            >
              <Sparkles className="h-4 w-4" strokeWidth={2.4} /> Write a first draft for me
            </button>
          </div>
        )}

        {step === 'price' && (
          <div className="flex flex-col gap-3.5">
            <Field label="Price" hint="Inclusive of GST. Your 5% platform fee comes out of this.">
              <LabInput
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="2400"
                disabled={form.price_on_request}
              />
            </Field>
            <label className="flex items-center gap-2.5">
              <Toggle checked={form.price_on_request} onChange={(v) => setForm((f) => ({ ...f, price_on_request: v }))} label="Price on request" />
              <span className="text-[13px] font-semibold text-ink/75">Price on request instead</span>
            </label>
            {form.price > 0 && (
              <div className="rounded-xl border-2 border-neutral-200 bg-cream p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink/45">On each booking</p>
                <ul className="mt-2 flex flex-col gap-1.5 text-[13px]">
                  <li className="flex justify-between"><span className="font-medium text-ink/65">Guest pays</span><span className="font-bold tabular-nums text-ink">{inr(form.price)}</span></li>
                  <li className="flex justify-between"><span className="font-medium text-ink/65">Platform fee (5%, Starter)</span><span className="font-bold tabular-nums text-ink/60">−{inr(Math.round(form.price * 0.05))}</span></li>
                  <li className="flex justify-between border-t-2 border-neutral-200 pt-1.5"><span className="font-bold text-ink">You keep</span><span className="font-bold tabular-nums text-maroon">{inr(form.price - Math.round(form.price * 0.05))}</span></li>
                  <li className="flex justify-between"><span className="font-medium text-success-fg">On Pro (0% fee)</span><span className="font-bold tabular-nums text-success-fg">{inr(form.price)}</span></li>
                </ul>
              </div>
            )}
            <div className="flex items-start gap-2.5 rounded-xl border-2 border-maroon-100 bg-maroon-50 p-3.5">
              <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-maroon" strokeWidth={2.2} />
              <p className="text-[12.5px] font-medium text-ink/70">
                Nutritionists in Pune charge <strong className="text-maroon">₹1,800–₹3,200</strong> for a 60-minute consult. You are
                {form.price ? (form.price > 3200 ? ' above' : form.price < 1800 ? ' below' : ' inside') : ' not yet in'} that band.
              </p>
            </div>
          </div>
        )}

        {step === 'page' && (
          <div className="flex flex-col gap-3.5">
            <label className="flex items-center gap-2.5">
              <Toggle checked={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} label="Live on booking page" />
              <span className="text-[13px] font-semibold text-ink/75">Live on your booking page</span>
            </label>
            <Field label="Link" hint="Share this to send someone straight to this one service.">
              <div className="flex gap-2">
                <LabInput readOnly value={`meeticulous.com/${mock.host.username}/${(form.title || 'new-service').toLowerCase().replace(/\s+/g, '-')}`} />
                <Button variant="outline" onClick={() => toast.success('Link copied')}><Copy className="h-4 w-4" strokeWidth={2.4} /></Button>
              </div>
            </Field>
            <div className="rounded-xl border-2 border-neutral-200 p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink/45">How it will look</p>
              <div className="rounded-lg border-2 border-neutral-200 bg-white p-3.5">
                <p className="font-display text-[15px] font-bold text-ink">{form.title || 'Your service name'}</p>
                <p className="mt-0.5 text-[12.5px] font-medium text-ink/55">{form.duration} min · {form.price_on_request ? 'Price on request' : form.price ? inr(form.price) : 'Free'}</p>
                <p className="mt-1.5 text-[12.5px] text-ink/70">{form.description || 'Your description shows here.'}</p>
                <span className="mt-2.5 inline-flex rounded-full bg-maroon px-3 py-1.5 text-[12px] font-bold text-white">Book</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

/* ── Services ──────────────────────────────────────────────────────────── */
const Services = ({ openId, onOpen }) => {
  const [items, setItems] = useState(mock.services);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const openService = items.find((s) => s.id === openId);
  const revenue = items.reduce((n, s) => n + s.revenue_30d, 0);

  return (
    <>
      <Panel
        title="Services"
        subtitle={`${items.filter((s) => s.active).length} live · ${inr(revenue)} in the last 30 days`}
        action={<Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" strokeWidth={2.6} /> New service</Button>}
        flush
      >
        <ul className="divide-y-2 divide-neutral-200">
          {items.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14px] font-bold text-ink">{s.title}</p>
                  <StatusPill status={s.active ? 'active' : 'inactive'} />
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] font-medium text-ink/55">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" strokeWidth={2.2} />{s.duration} min</span>
                  <span className="inline-flex items-center gap-1"><IndianRupee className="h-3.5 w-3.5" strokeWidth={2.2} />{s.price_on_request ? 'On request' : s.price ? inr(s.price) : 'Free'}</span>
                </p>
              </div>

              {/* Per-row performance: the live page shows none of this. */}
              <div className="flex shrink-0 gap-4 sm:gap-5">
                {[
                  ['Booked', s.bookings_30d],
                  ['Revenue', inr(s.revenue_30d, { compact: true })],
                  ['View → book', s.conversion ? pct(s.conversion) : '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink/40">{k}</p>
                    <p className="font-display text-[15px] font-extrabold tabular-nums text-ink">{v}</p>
                  </div>
                ))}
              </div>

              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => setEditing(s)} aria-label={`Edit ${s.title}`} className="grid h-8 w-8 place-items-center rounded-full text-ink/45 transition hover:bg-blush hover:text-maroon">
                  <Pencil className="h-4 w-4" strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={() => { setItems((v) => v.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x))); toast.success(`${s.title} ${s.active ? 'hidden' : 'live'}`); }}
                  aria-label={`${s.active ? 'Hide' : 'Show'} ${s.title}`}
                  className="grid h-8 w-8 place-items-center rounded-full text-ink/45 transition hover:bg-blush hover:text-maroon"
                >
                  {s.active ? <EyeOff className="h-4 w-4" strokeWidth={2.2} /> : <Eye className="h-4 w-4" strokeWidth={2.2} />}
                </button>
                <button
                  type="button"
                  onClick={() => { setItems((v) => [...v, { ...s, id: `${s.id}-copy`, title: `${s.title} (copy)`, active: false, bookings_30d: 0, revenue_30d: 0 }]); toast.success(`${s.title} duplicated`); }}
                  aria-label={`Duplicate ${s.title}`}
                  className="grid h-8 w-8 place-items-center rounded-full text-ink/45 transition hover:bg-blush hover:text-maroon"
                >
                  <Copy className="h-4 w-4" strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={() => { setItems((v) => v.filter((x) => x.id !== s.id)); toast.success(`${s.title} deleted`); }}
                  aria-label={`Delete ${s.title}`}
                  className="grid h-8 w-8 place-items-center rounded-full text-ink/35 transition hover:bg-error-bg hover:text-error-fg"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {(editing || openService) && <ServiceEditor service={editing || openService} onClose={() => { setEditing(null); onOpen(null); }} />}
      {creating && <ServiceEditor onClose={() => setCreating(false)} />}
    </>
  );
};

/* ── Products / Courses / Memberships / Offers ─────────────────────────── */
const SimpleList = ({ title, subtitle, cta, rows, columns, icon: Icon, emptyLine }) => (
  <Panel
    title={title}
    subtitle={subtitle}
    action={<Button size="sm" onClick={() => toast.success(`Opens the ${cta.toLowerCase()} form`)}><Plus className="h-4 w-4" strokeWidth={2.6} /> {cta}</Button>}
    flush
  >
    {rows.length === 0 ? (
      <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
        <Icon className="h-7 w-7 text-maroon/30" strokeWidth={1.8} />
        <p className="text-[14px] font-bold text-ink">Nothing here yet</p>
        <p className="max-w-sm text-[12.5px] font-medium text-ink/55">{emptyLine}</p>
        <Button size="sm" className="mt-1" onClick={() => toast.success(`Opens the ${cta.toLowerCase()} form`)}>{cta}</Button>
      </div>
    ) : (
      <ul className="divide-y-2 divide-neutral-200">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-2.5 px-4 py-3.5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[14px] font-bold text-ink">{r.title || r.code}</p>
                {r.state && <StatusPill status={r.state} />}
              </div>
              {r.meta && <p className="mt-0.5 text-[12.5px] font-medium text-ink/55">{r.meta}</p>}
            </div>
            <div className="flex shrink-0 gap-4 sm:gap-5">
              {columns.map(([k, get]) => (
                <div key={k}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink/40">{k}</p>
                  <p className="font-display text-[15px] font-extrabold tabular-nums text-ink">{get(r)}</p>
                </div>
              ))}
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={() => toast.success(`Editing ${r.title || r.code}`)} aria-label={`Edit ${r.title || r.code}`} className="grid h-8 w-8 place-items-center rounded-full text-ink/45 transition hover:bg-blush hover:text-maroon">
                <Pencil className="h-4 w-4" strokeWidth={2.2} />
              </button>
              <button type="button" onClick={() => toast.success('Link copied')} aria-label={`Share ${r.title || r.code}`} className="grid h-8 w-8 place-items-center rounded-full text-ink/45 transition hover:bg-blush hover:text-maroon">
                <Share2 className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    )}
  </Panel>
);

const couponState = (c) => {
  if (!c.active) return 'inactive';
  if (c.expires_at && new Date(c.expires_at) < new Date()) return 'expired';
  if (c.max_redemptions != null && c.times_redeemed >= c.max_redemptions) return 'used_up';
  return 'active';
};

/* ── Page ──────────────────────────────────────────────────────────────── */
const Catalog = () => {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('service') ? 'services' : params.get('tab') || 'services');
  const [serviceId, setServiceId] = useState(params.get('service'));

  const TABS = useMemo(() => [
    { value: 'services', label: 'Services', count: mock.services.length },
    { value: 'products', label: 'Products', count: mock.products.length },
    { value: 'courses', label: 'Courses', count: mock.courses.length },
    { value: 'memberships', label: 'Memberships', count: 0 },
    { value: 'offers', label: 'Offers', count: mock.offers.length },
  ], []);

  const totalEarned = mock.services.reduce((n, s) => n + s.revenue_30d, 0)
    + mock.products.reduce((n, p) => n + p.revenue_30d, 0)
    + mock.courses.reduce((n, c) => n + c.revenue_30d, 0);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="mb-0 font-display text-[26px] font-extrabold tracking-[-0.03em] text-maroon sm:text-[30px]">Catalog</h1>
        <p className="mt-0.5 text-[13.5px] font-medium text-ink/55">
          Everything you sell · {inr(totalEarned)} earned in the last 30 days
        </p>
      </header>

      <Tabs tabs={TABS} value={tab} onChange={(v) => { setTab(v); setServiceId(null); setParams({}, { replace: true }); }} />

      {tab === 'services' && <Services openId={serviceId} onOpen={setServiceId} />}

      {tab === 'products' && (
        <SimpleList
          title="Digital products"
          subtitle={`${mock.products.length} on sale · ${inr(mock.products.reduce((n, p) => n + p.revenue_30d, 0))} in 30 days`}
          cta="New product"
          icon={FileDown}
          emptyLine="A PDF, a template, a recording. It sells while you sleep and needs no slot on your calendar."
          rows={mock.products.map((p) => ({ ...p, state: p.active ? 'active' : 'inactive', meta: `${p.price ? inr(p.price) : 'Free'} · instant download` }))}
          columns={[['Sold', (r) => r.sales_30d], ['Revenue', (r) => inr(r.revenue_30d, { compact: true })]]}
        />
      )}

      {tab === 'courses' && (
        <SimpleList
          title="Courses"
          subtitle={`${mock.courses.length} published`}
          cta="New course"
          icon={BookOpen}
          emptyLine="Teach once, sell many times. Lessons, drip release and a student list."
          rows={mock.courses.map((c) => ({ ...c, state: c.active ? 'active' : 'inactive', meta: `${inr(c.price)} · ${c.lessons} lessons` }))}
          columns={[['Enrolled', (r) => r.enrolled], ['Revenue', (r) => inr(r.revenue_30d, { compact: true })]]}
        />
      )}

      {tab === 'memberships' && (
        <SimpleList
          title="Memberships"
          subtitle="Recurring access, charged monthly"
          cta="New membership"
          icon={Users}
          emptyLine="A monthly fee for ongoing access — the steadiest revenue a host can build. Set a price, pick what members get."
          rows={[]}
          columns={[]}
        />
      )}

      {tab === 'offers' && (
        <>
          <SimpleList
            title="Coupon codes"
            subtitle={`${mock.offers.filter((o) => couponState(o) === 'active').length} active`}
            cta="New code"
            icon={Ticket}
            emptyLine="A code for a launch, a festival or a returning client."
            rows={mock.offers.map((o) => ({
              ...o,
              state: couponState(o),
              meta: `${o.discount_type === 'percent' ? `${o.discount_value}% off` : `${inr(o.discount_value)} off`}${o.expires_at ? ` · expires ${fmtDayFull(o.expires_at)}` : ' · no expiry'}`,
            }))}
            columns={[['Used', (r) => `${r.times_redeemed}${r.max_redemptions ? `/${r.max_redemptions}` : ''}`]]}
          />
          <p className="flex items-start gap-2 rounded-xl border-2 border-marigold-300 bg-marigold-100 px-4 py-3 text-[12.5px] font-medium text-marigold-800">
            <Package className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
            Coupons sit behind the <code className="rounded bg-white/70 px-1 font-mono text-[11.5px]">coupons</code> flag, which is off in production today. The tab is shown here because the feature exists and is finished — the flag is the only thing between it and hosts.
          </p>
        </>
      )}
    </div>
  );
};

export default Catalog;
