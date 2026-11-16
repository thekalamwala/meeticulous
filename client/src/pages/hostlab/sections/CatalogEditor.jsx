// CatalogEditor — one page for everything a host sells.
//
// The old editor was a three-step modal, and only services had one; products,
// courses, memberships and coupons had no editor at all. A modal also lies
// about the work: it looks like a quick confirmation, then asks you to write a
// description and price a thing.
//
// So: a real page at /host-lab/catalog/:id. It scrolls, it is one form, it
// submits once. The fields come from the type descriptor in catalogTypes.js,
// which means a new kind of product is a new entry in that file, not a new
// page. Nothing here knows what a service is.
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Copy, Sparkles, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, cn } from '../../../components/dashboard/ui';
import { Field, LabInput, LabSelect, LabTextarea, Panel, Toggle, inr } from '../labUi';
import { CATALOG_TYPES, blankItem, groupsFor } from '../catalogTypes';
import { allItems } from '../catalogData';
import mock from '../mockData';

/* ── One field, driven entirely by its descriptor ──────────────────────── */
const Control = ({ field, value, onChange, disabled }) => {
  const common = { disabled, 'aria-label': field.label };

  switch (field.control) {
    case 'textarea':
      return <LabTextarea rows={field.rows || 3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />;

    case 'select':
      return (
        <LabSelect value={value} onChange={(e) => onChange(field.options[0] && typeof field.options[0].value === 'number' ? +e.target.value : e.target.value)} {...common}>
          {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </LabSelect>
      );

    case 'toggle':
      return (
        <label className="flex items-center gap-2.5 py-1">
          <Toggle checked={!!value} onChange={onChange} label={field.label} />
          <span className="text-[12px] font-semibold text-ink/75">{field.label}</span>
        </label>
      );

    case 'money':
      return (
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] font-bold text-ink/40">₹</span>
          <LabInput type="number" min={0} className="pl-6" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="0" {...common} />
        </div>
      );

    case 'number':
      return <LabInput type="number" min={0} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />;

    case 'date':
      return <LabInput type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />;

    case 'file':
      return (
        <button
          type="button"
          onClick={() => toast.success('Opens the file picker')}
          className="flex w-full items-center justify-center gap-2 rounded-sm border-2 border-dashed border-neutral-300 bg-cream py-4 text-[12px] font-semibold text-ink/55 transition hover:border-maroon/40 hover:text-maroon"
        >
          <Upload className="h-3.5 w-3.5" strokeWidth={2.4} />
          {value || 'Choose a file'}
        </button>
      );

    default:
      return (
        <LabInput
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={field.mono ? 'font-mono tracking-wide' : undefined}
          {...common}
        />
      );
  }
};

/* ── What a guest will see ─────────────────────────────────────────────── */
const Preview = ({ type, form }) => {
  const name = form[type.nameField];
  const price = form.price_on_request ? 'Price on request' : form.price ? inr(form.price) : 'Free';
  return (
    <Panel title="What a guest sees" subtitle="Updates as you type">
      <div className="rounded-sm border-2 border-neutral-200 bg-white p-3">
        <p className="font-display text-[13.5px] font-bold text-ink">{name || `Your ${type.label.toLowerCase()} name`}</p>
        <p className="mt-0.5 text-[11.5px] font-medium text-ink/55">
          {type.takesSlot && form.duration ? `${form.duration} min · ` : ''}{price}
        </p>
        <p className="mt-1.5 text-[11.5px] leading-snug text-ink/70">
          {form.description || 'Your description shows here.'}
        </p>
        <span className="mt-2 inline-flex rounded-full bg-maroon px-2.5 py-1 text-[11px] font-bold text-white">
          {type.takesSlot ? 'Book' : 'Buy'}
        </span>
      </div>
      {!form.active && (
        <p className="mt-2.5 rounded-sm bg-warning-bg px-2.5 py-1.5 text-[11px] font-semibold text-warning-fg">
          Hidden — no guest can see this yet.
        </p>
      )}
    </Panel>
  );
};

/* ── Page ──────────────────────────────────────────────────────────────── */
const CatalogEditor = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const existing = useMemo(() => (isNew ? null : allItems().find((x) => x.id === id)), [id, isNew]);
  const typeKey = existing?.kind || params.get('type') || 'service';
  const type = CATALOG_TYPES[typeKey];

  const [form, setForm] = useState(() => ({ ...blankItem(typeKey), ...(existing || {}) }));
  const [dirty, setDirty] = useState(false);
  const set = (key) => (v) => { setForm((f) => ({ ...f, [key]: v })); setDirty(true); };

  const name = form[type.nameField];
  const valid = String(name || '').trim().length > 1;
  const back = () => navigate('/host-lab/catalog');

  const save = () => {
    if (!valid) return;
    toast.success(isNew ? `${name} created` : `${name} saved`);
    back();
  };

  const fee = Math.round((Number(form.price) || 0) * 0.05);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={back}
          className="inline-flex h-7 items-center gap-1 rounded-sm px-1.5 text-[11.5px] font-bold text-ink/55 transition hover:bg-blush hover:text-maroon"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.6} /> Catalog
        </button>
        <span className="inline-flex items-center gap-1 rounded-full bg-blush px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-maroon">
          <type.icon className="h-3 w-3" strokeWidth={2.6} /> {type.label}
        </span>
        <div className="w-full">
          <h1 className="mb-0 font-display text-[17px] font-extrabold tracking-[-0.03em] text-maroon sm:text-[18px]">
            {isNew ? `New ${type.label.toLowerCase()}` : name || `Untitled ${type.label.toLowerCase()}`}
          </h1>
          <p className="mt-0.5 text-[12px] font-medium text-ink/55">{type.blurb}</p>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        {/* The form — one page, every field, one submit */}
        <form
          className="flex min-w-0 flex-col gap-3"
          onSubmit={(e) => { e.preventDefault(); save(); }}
        >
          {groupsFor(type).map((group) => (
            <Panel key={group.key} title={group.title} subtitle={group.hint}>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.fields.map((f) => {
                  const disabled = f.disabledBy ? !!form[f.disabledBy] : false;
                  const full = !f.half || f.control === 'toggle' || f.control === 'textarea' || f.control === 'file';
                  if (f.control === 'toggle') {
                    return (
                      <div key={f.key} className={full ? 'sm:col-span-2' : undefined}>
                        <Control field={f} value={form[f.key]} onChange={set(f.key)} />
                        {f.hint && <p className="mt-0.5 text-[11px] font-medium text-ink/45">{f.hint}</p>}
                      </div>
                    );
                  }
                  return (
                    <Field
                      key={f.key}
                      label={f.label + (f.required ? '' : '')}
                      hint={f.hint}
                      className={full ? 'sm:col-span-2' : undefined}
                    >
                      <Control field={f} value={form[f.key]} onChange={set(f.key)} disabled={disabled} />
                      {f.ai && (
                        <button
                          type="button"
                          onClick={() => { set('description')('A full look at your diet history and recent bloodwork, then a four-week plan you can actually cook. You leave with a grocery list and a follow-up date.'); toast.success('Draft written — edit it to sound like you'); }}
                          className="mt-1.5 inline-flex items-center gap-1 rounded-full border-2 border-maroon px-2 py-0.5 text-[11px] font-bold text-maroon transition hover:bg-pink-100"
                        >
                          <Sparkles className="h-3 w-3" strokeWidth={2.6} /> Write a first draft for me
                        </button>
                      )}
                    </Field>
                  );
                })}
              </div>

              {/* Pricing group carries the arithmetic, for every type that has a price */}
              {group.key === 'pricing' && form.price > 0 && (
                <div className="mt-3 rounded-sm border-2 border-neutral-200 bg-cream p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink/45">On each sale</p>
                  <ul className="mt-1.5 flex flex-col gap-1 text-[11.5px]">
                    <li className="flex justify-between"><span className="font-medium text-ink/65">Guest pays</span><span className="font-bold tabular-nums text-ink">{inr(form.price)}</span></li>
                    <li className="flex justify-between"><span className="font-medium text-ink/65">Platform fee on Starter (5%)</span><span className="font-bold tabular-nums text-ink/55">−{inr(fee)}</span></li>
                    <li className="flex justify-between border-t-2 border-neutral-200 pt-1"><span className="font-bold text-ink">You keep on Pro</span><span className="font-bold tabular-nums text-maroon">{inr(form.price)}</span></li>
                  </ul>
                </div>
              )}

              {/* Share link lives with the page group, for anything a guest opens */}
              {group.key === 'page' && !type.noPreview && (
                <Field label="Direct link" hint="Share this to send someone straight here." className="mt-3">
                  <div className="flex gap-1.5">
                    <LabInput
                      readOnly
                      value={`meeticulous.com/${mock.host.username}/${String(name || 'new').toLowerCase().replace(/\s+/g, '-')}`}
                      className="font-mono text-[11px]"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={() => toast.success('Link copied')}>
                      <Copy className="h-3.5 w-3.5" strokeWidth={2.4} />
                    </Button>
                  </div>
                </Field>
              )}
            </Panel>
          ))}

          {/* One submit, at the end of the page it belongs to */}
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border-2 border-neutral-200 bg-white/95 p-2 backdrop-blur">
            {dirty && <span className="text-[11px] font-bold text-marigold-800">Unsaved changes</span>}
            {!valid && <span className="text-[11px] font-semibold text-warning-fg">Give it a name first.</span>}
            <div className="ml-auto flex items-center gap-1.5">
              {!isNew && (
                <button
                  type="button"
                  onClick={() => { toast.success(`${name} deleted`); back(); }}
                  className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-bold text-error-fg transition hover:bg-error-bg"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.4} /> Delete
                </button>
              )}
              <Button type="button" size="sm" variant="outline" onClick={back}>Cancel</Button>
              <Button type="submit" size="sm" disabled={!valid}>
                {isNew ? `Create ${type.label.toLowerCase()}` : 'Save changes'}
              </Button>
            </div>
          </div>
        </form>

        {/* Preview */}
        <div className="min-w-0">
          <div className="lg:sticky lg:top-14">
            {type.noPreview ? (
              <Panel title="How it works" subtitle={type.blurb}>
                <ul className="flex flex-col gap-2 text-[11.5px] font-medium text-ink/70">
                  {[
                    'A guest types the code at checkout.',
                    'It comes off before payment, so they see the real total.',
                    'It stops working on its own once it expires or runs out.',
                  ].map((t, i) => (
                    <li key={t} className="flex gap-2">
                      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-blush text-[9.5px] font-bold text-maroon">{i + 1}</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : (
              <Preview type={type} form={form} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogEditor;
