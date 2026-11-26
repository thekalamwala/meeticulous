// Grow → Reviews (formerly Social proof). Two kinds of proof, kept apart because
// they are different things: reviews guests left after a booking (read-only here,
// from GET /reviews/received — the verified rating) and quotes the host collected
// elsewhere (testimonials CRUD, unchanged: same API calls, same free-plan cap,
// the server's 409 is still the real enforcement).
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Plus, Quote, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  createTestimonial, deleteTestimonial, getMyTestimonials, getReceivedReviews, updateTestimonial,
} from '../../services/api';
import { isFreePlan } from '../../utils/themeUtils';
import { ErrorState, Skeleton } from '../../components/dashboard/ui';
import { useRegisterRefresh } from '../../components/dashboard/ui/refreshContext';
import { Avatar, Tile, cn, relDay } from '../../components/dashboard/ui/v2';
import GrowShell, {
  CardHead, Empty, Field, PinnedBar, Sheet, btnDanger, btnPrimary, btnSoft, card, input, rowBase, useIsDesktop,
} from './GrowShell';
import { reviewsSentence } from './growModel';

// Keep in sync with testimonialController.FREE_CAP (server is the source of truth).
export const FREE_CAP = 3;
const EMPTY = { quote: '', author_name: '', author_role: '', author_image_url: '' };

const Stars = ({ n }) => (
  <span className="inline-flex shrink-0 items-center gap-0.5" aria-label={`${n} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={cn('h-3.5 w-3.5', i <= n ? 'fill-maroon text-maroon' : 'fill-neutral-200 text-neutral-200')} strokeWidth={1.5} />
    ))}
  </span>
);

const ReviewRow = ({ r }) => {
  const name = r.profiles?.name || 'A guest';
  const svc = r.bookings?.services?.title;
  return (
    <li className="flex gap-3 px-5 py-4 sm:px-6">
      <Avatar name={name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="mb-0 min-w-0 flex-1 truncate text-[14.5px] font-semibold text-ink">{name}</p>
          <Stars n={Number(r.rating) || 0} />
        </div>
        <p className="mb-0 truncate text-[12.5px] text-muted">{[svc, relDay(r.created_at)].filter(Boolean).join(' · ')}</p>
        {r.comment
          ? <p className="mb-0 mt-1.5 line-clamp-4 break-words text-[14px] leading-relaxed text-ink/80">{r.comment}</p>
          : <p className="mb-0 mt-1.5 text-[13px] italic text-faint">Left a rating without a comment.</p>}
      </div>
    </li>
  );
};

export default function GrowReviews() {
  const { user } = useAuth();
  const isFree = isFreePlan(user?.plan);
  const isDesktop = useIsDesktop();
  const [reviews, setReviews] = useState(undefined); // undefined = loading, null = failed
  const [quotes, setQuotes] = useState(undefined);
  const [editing, setEditing] = useState(null); // null | 'new' | testimonial
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const loadQuotes = useCallback(() => getMyTestimonials()
    .then(({ data }) => setQuotes(Array.isArray(data) ? data : []))
    .catch(() => setQuotes(null)), []);
  const loadReviews = useCallback(() => getReceivedReviews('guest_to_host')
    .then(({ data }) => setReviews({ list: data?.reviews || [], count: Number(data?.count) || 0, avg: Number(data?.avg) || 0 }))
    .catch(() => setReviews(null)), []);
  const load = useCallback(() => Promise.all([loadQuotes(), loadReviews()]), [loadQuotes, loadReviews]);
  useEffect(() => { load(); }, [load]);
  useRegisterRefresh(load);

  const atCap = isFree && (quotes?.length || 0) >= FREE_CAP;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const openNew = () => { setForm(EMPTY); setEditing('new'); };
  const openEdit = (t) => {
    setForm({ quote: t.quote || '', author_name: t.author_name || '', author_role: t.author_role || '', author_image_url: t.author_image_url || '' });
    setEditing(t);
  };
  const close = () => { setEditing(null); setConfirmDel(false); };

  const save = async (e) => {
    e?.preventDefault();
    const payload = {
      quote: form.quote.trim(),
      author_name: form.author_name.trim(),
      author_role: form.author_role.trim() || null,
      author_image_url: form.author_image_url.trim() || null,
    };
    if (!payload.quote || !payload.author_name) { toast.error('Add the quote and who said it.'); return; }
    setSaving(true);
    try {
      if (editing === 'new') { await createTestimonial(payload); toast.success('Quote added to your page'); }
      else { await updateTestimonial(editing.id, payload); toast.success('Quote updated'); }
      close();
      loadQuotes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the quote');
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    setSaving(true);
    try {
      await deleteTestimonial(editing.id);
      setQuotes((list) => (list || []).filter((x) => x.id !== editing.id));
      toast.success('Quote removed');
      close();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove the quote');
    } finally {
      setSaving(false);
    }
  };

  const addBtn = (cls = '') => (
    <button type="button" onClick={openNew} className={cn(btnPrimary, cls)}><Plus className="h-4 w-4" strokeWidth={2.4} /> Add a quote</button>
  );
  const loading = reviews === undefined || quotes === undefined;

  return (
    <GrowShell sub="Reviews, formerly Social proof: what guests said, and quotes you collected.">
      {/* Headline figures — sentences when there is nothing to count. */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:gap-4">{[0, 1].map((i) => <Skeleton key={i} className="h-[120px] rounded-[20px]" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:gap-4">
          {reviews === null ? <Tile label="Guest rating" value={null} note="Could not load your rating" />
            : reviews.count ? <Tile label="Guest rating" value={`${reviews.avg.toFixed(1)}★`} hint={`${reviews.count} ${reviews.count === 1 ? 'review' : 'reviews'}`} />
              : <Tile label="Guest rating" value={null} note="No ratings yet" hint="After a completed booking" />}
          {quotes === null ? <Tile label="Quotes on your page" value={null} note="Could not load your quotes" />
            : <Tile label="Quotes on your page" value={quotes.length}
              hint={isFree ? `${Math.min(quotes.length, FREE_CAP)} of ${FREE_CAP} on Starter` : 'No limit on Pro'} />}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start lg:gap-6">
        {/* Guest reviews — the verified rating. Read-only here. */}
        <section aria-labelledby="rv-guests" className={cn(card, 'overflow-hidden')}>
          <CardHead id="rv-guests" title="From guests" sub={reviews ? reviewsSentence(reviews) : 'Left after a completed booking.'} />
          <div className="mt-3 border-t border-neutral-200">
            {reviews === undefined && <div className="flex flex-col gap-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-[16px]" />)}</div>}
            {reviews === null && <div className="p-5"><ErrorState message="Couldn't load your reviews." onRetry={loadReviews} /></div>}
            {reviews && reviews.list.length === 0 && (
              <Empty compact title="No guest reviews yet" body="Guests can rate you after a completed booking. They show here and on your page." />
            )}
            {reviews && reviews.list.length > 0 && (
              <ul className="divide-y divide-neutral-200">{reviews.list.map((r) => <ReviewRow key={r.id} r={r} />)}</ul>
            )}
          </div>
        </section>

        {/* Quotes the host collected — WhatsApp, DMs, emails. Tap one to edit. */}
        <section aria-labelledby="rv-quotes" className={cn(card, 'overflow-hidden')}>
          <CardHead id="rv-quotes" title="Quotes you collected"
            sub="Praise from WhatsApp, DMs or email. Shown on your page, never counted in your rating."
            action={isDesktop && quotes?.length > 0 && !atCap ? addBtn() : null} />
          <div className="mt-3 border-t border-neutral-200">
            {quotes === undefined && <div className="flex flex-col gap-3 p-5">{[0, 1].map((i) => <Skeleton key={i} className="h-16 rounded-[16px]" />)}</div>}
            {quotes === null && <div className="p-5"><ErrorState message="Couldn't load your quotes." onRetry={loadQuotes} /></div>}
            {quotes && quotes.length === 0 && (
              <Empty compact title="No quotes yet" body="Paste a kind message a client sent you. It shows on your page as proof."
                action={isDesktop ? addBtn() : null} />
            )}
            {quotes && quotes.length > 0 && (
              <ul className="divide-y divide-neutral-200">
                {quotes.map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => openEdit(t)} className={cn(rowBase, 'items-start py-4')} aria-label={`Edit quote from ${t.author_name}`}>
                      <Quote className="mt-0.5 h-5 w-5 shrink-0 text-maroon/50" strokeWidth={2} />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-3 break-words text-[14px] leading-relaxed text-ink">{t.quote}</span>
                        <span className="mt-1 block truncate text-[12.5px] font-semibold text-muted">{t.author_name}</span>
                        {t.author_role && <span className="block truncate text-[12.5px] text-muted">{t.author_role}</span>}
                      </span>
                      <span className="shrink-0 text-[13.5px] font-semibold text-maroon">Edit</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {atCap && (
              // Pro-locked: a ghost row, never a fake entry or a zero.
              <Link to="/dashboard/upgrade?src=testimonials" className={cn(rowBase, 'border-t border-neutral-200 bg-cream/60')}>
                <Lock className="h-4 w-4 shrink-0 text-maroon" strokeWidth={2.2} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-ink">Starter shows {FREE_CAP} quotes</span>
                  <span className="block truncate text-[12.5px] text-muted">Pro shows every one you add</span>
                </span>
                <span className="shrink-0 rounded-[8px] bg-pink-100 px-2 py-0.5 text-[12px] font-semibold text-maroon">Pro</span>
              </Link>
            )}
          </div>
        </section>
      </div>

      {/* Phone: the one action in the thumb zone. */}
      {!isDesktop && quotes && !atCap && <PinnedBar>{addBtn('w-full')}</PinnedBar>}
      {!isDesktop && quotes && !atCap && <div aria-hidden="true" className="h-14" />}

      <Sheet open={!!editing} onClose={close} width="sm:w-[480px]"
        title={confirmDel ? 'Remove this quote?' : editing === 'new' ? 'Add a quote' : 'Edit quote'}
        footer={confirmDel ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmDel(false)} disabled={saving} className={cn(btnSoft, 'flex-1')}>Keep it</button>
            <button type="button" onClick={remove} disabled={saving} className={cn(btnDanger, 'flex-1')}>{saving ? 'Removing…' : 'Remove'}</button>
          </div>
        ) : (
          <div className="flex gap-2">
            {editing && editing !== 'new' && (
              <button type="button" onClick={() => setConfirmDel(true)} disabled={saving} className={cn(btnDanger, 'flex-1')}>Remove</button>
            )}
            <button type="submit" form="rv-form" disabled={saving} className={cn(btnPrimary, 'flex-[2]')}>
              {saving ? 'Saving…' : editing === 'new' ? 'Add to my page' : 'Save'}
            </button>
          </div>
        )}>
        {confirmDel ? (
          <p className="mb-0 pt-1 text-[14px] text-muted">It comes off your page straight away. This can&apos;t be undone.</p>
        ) : (
          <form id="rv-form" onSubmit={save} className="flex flex-col gap-4 pt-1">
            <Field label="What they said" htmlFor="rv-quote">
              <textarea id="rv-quote" rows={4} value={form.quote} onChange={set('quote')} maxLength={2000}
                placeholder="In their words. One or two sentences read best." className={cn(input, 'resize-y py-3 leading-relaxed')} />
            </Field>
            <Field label="Their name" htmlFor="rv-name">
              <input id="rv-name" value={form.author_name} onChange={set('author_name')} maxLength={120} placeholder="Priya Sharma" className={cn(input, 'h-12')} />
            </Field>
            <Field label="What they do" htmlFor="rv-role" hint="Optional.">
              <input id="rv-role" value={form.author_role} onChange={set('author_role')} maxLength={160} placeholder="Founder, Acme Co." className={cn(input, 'h-12')} />
            </Field>
            <Field label="Photo link" htmlFor="rv-img" hint="Optional. A web address for their photo.">
              <input id="rv-img" type="url" value={form.author_image_url} onChange={set('author_image_url')} placeholder="https://…" autoCapitalize="off" className={cn(input, 'h-12')} />
            </Field>
          </form>
        )}
      </Sheet>
    </GrowShell>
  );
}
