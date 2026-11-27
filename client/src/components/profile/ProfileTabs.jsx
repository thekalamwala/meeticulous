// Public host profile tabs — Courses + Membership content (Products reuses the
// profile's own ProductCard). Rendered by pages/HostProfile.jsx under
// /:username/courses and /:username/membership, beside the same left profile card.
// Colours come in as `C` (the profile's neutral chrome) + the host accent via
// --profile-accent, so these match the services grid exactly.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Lock, PlayCircle, Crown } from "lucide-react";
import toast from "react-hot-toast";
import { joinMembership, createMembershipSubscription, syncMembershipSubscription, verifyMembershipUpgrade } from "../../services/api";
import loadRazorpay from "../../utils/loadRazorpay";
import { useAuth } from "../../context/AuthContext";
import ItemCard from "../community/ItemCard";
import FaqAccordion from "../FaqAccordion";
import { coursePath, tierAnchors } from "../../utils/seo";

const ACCENT = 'var(--profile-accent, #960D32)';
const ACCENT_LIGHT = 'var(--profile-accent-light, #FFE4EA)';
const ACCENT_TEXT = 'var(--profile-accent-text, #ffffff)';

// "Courses" / "Membership" heading — same two-line shape as the Feed tab.
export const ProfileTabHeading = ({ eyebrow, title, C }) => (
  <div className="mb-5">
    <div className="font-serif italic text-base" style={{ color: '#E0506F' }}>{eyebrow}</div>
    <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight" style={{ color: C.text }}>{title}</h2>
  </div>
);

const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// Answer-first summary + visible FAQ for a profile tab (and its FAQPage schema —
// HostProfile emits the FAQ only while this renders it). Copy comes from the
// data-built templates in utils/seo.js + utils/profileFaqs.js.
export const ProfileTabAnswer = ({ summary, C }) => (
  summary ? <p className="mb-5 text-sm leading-relaxed" style={{ color: C.secondary }}>{summary}</p> : null
);
// Headed, self-contained sections from utils/profileFaqs catalogSections (real
// data only; the bot shell renders the same blocks): h2 + text + list + steps.
export const CatalogSections = ({ sections, C }) => (sections || []).map((s) => (
  <section key={s.key} className="mt-10" aria-labelledby={`sec-${s.key}`}>
    <h2 id={`sec-${s.key}`} className="font-display font-bold text-xl mb-3" style={{ color: C.text }}>{s.heading}</h2>
    {(s.paras || []).map((t, i) => <p key={i} className="text-sm leading-relaxed mb-2" style={{ color: C.secondary }}>{t}</p>)}
    {s.list?.length > 0 && (
      <ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed" style={{ color: C.secondary }}>
        {s.list.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    )}
    {s.steps?.length > 0 && (
      <ol className="list-decimal pl-5 space-y-1 text-sm leading-relaxed" style={{ color: C.secondary }}>
        {s.steps.map((t, i) => <li key={i}>{t}</li>)}
      </ol>
    )}
  </section>
));

// "Updated 27 Nov 2026" — visible freshness, the same date the JSON-LD carries.
export const UpdatedNote = ({ ts, label, C }) => (
  label ? <p className="-mt-3 mb-5 text-xs" style={{ color: C.muted }}><time dateTime={ts}>{label}</time></p> : null
);

export const ProfileTabFaq = ({ faqs, C }) => (
  faqs && faqs.length ? (
    <div className="mt-10">
      <h2 className="font-display font-bold text-xl mb-4" style={{ color: C.text }}>Frequently asked questions</h2>
      <FaqAccordion faqs={faqs} colors={C} />
    </div>
  ) : null
);

// ─── Course card — cover, title, lesson count, price. Duration is not tracked
// on lessons, so the card shows only what we have. ─────────────────────────────
export const CourseCard = ({ course: c, profileSlug, C }) => {
  const url = coursePath(profileSlug, c.slug);
  const isFree = Number(c.price) === 0;
  const lessons = Number(c.lesson_count) || 0;
  return (
    <article className="flex flex-row sm:flex-col bg-white rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
      <Link to={url} className="relative flex-shrink-0 w-28 self-stretch sm:w-full sm:self-auto aspect-[16/9] overflow-hidden" style={{ background: ACCENT_LIGHT }}
        aria-label={c.title}>
        {c.thumbnail_url
          ? <img src={c.thumbnail_url} alt={`${c.title} cover`} loading="lazy" decoding="async" className="w-full h-full object-cover" />
          : <span className="absolute inset-0 flex items-center justify-center" style={{ color: ACCENT }}><PlayCircle className="w-10 h-10" strokeWidth={1.6} /></span>}
      </Link>
      <div className="flex flex-col gap-1.5 p-4 flex-1 min-w-0">
        <h3 className="m-0 font-display font-bold leading-snug line-clamp-2" style={{ fontSize: 15 }}>
          <Link to={url} className="hover:opacity-60 transition-opacity" style={{ color: C.text }}>{c.title}</Link>
        </h3>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: C.muted }}>
          <PlayCircle className="w-3.5 h-3.5" strokeWidth={2} />
          {lessons} {lessons === 1 ? 'lesson' : 'lessons'}
        </div>
        {c.lessons?.length > 0 && (
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: C.secondary }}>Lessons: {c.lessons.join(', ')}</p>
        )}
        {c.description && <p className="hidden sm:block text-sm leading-relaxed line-clamp-2" style={{ color: C.secondary }}>{c.description}</p>}
        <div className="flex items-center justify-between mt-auto pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="font-display font-extrabold leading-none" style={{ color: C.text, fontSize: 20 }}>{isFree ? 'Free' : rupees(c.price)}</div>
          <Link to={url} className="text-sm font-semibold flex items-center rounded-full transition-all hover:opacity-90 active:scale-[0.97]"
            style={{ background: ACCENT, color: ACCENT_TEXT, height: 36, padding: '0 16px' }}>
            View course
          </Link>
        </div>
      </div>
    </article>
  );
};

// ─── Membership — the host's program, its tiers and member posts. Join/checkout
// is the flow that lived on the standalone /:username/membership page. `data` is
// the GET /memberships/space/:username payload; `onReload` refetches it. ────────
export const ProfileMembership = ({ username, data, onReload, C }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [joining, setJoining] = useState(null);
  const { host, program, tiers = [], posts = [], viewer_membership: mine } = data;
  // #<tier-slug> anchors — the membership JSON-LD addresses each tier by them.
  const anchors = tierAnchors(tiers);

  const join = async (tier) => {
    if (!user) { navigate(`/login?next=/${username}/membership`); return; }
    setJoining(tier.id);
    try {
      if (tier.type === "free") {
        await joinMembership(tier.id);
        toast.success(`You're in — ${tier.name}`);
        await onReload(); // unlocks posts in place
        return;
      }
      // Paid: Razorpay recurring checkout. Webhook grants entitlement; sync is the on-return fallback.
      const loaded = await loadRazorpay();
      if (!loaded) { toast.error("Payment gateway failed to load"); return; }
      const { data: sub } = await createMembershipSubscription(tier.id);

      // Moving up from a cheaper paid tier: a one-time order for the prorated
      // difference, not a new mandate. The recurring one starts at the old period end.
      if (sub.upgrade) {
        new window.Razorpay({
          key: sub.key,
          order_id: sub.razorpay_order_id,
          amount: sub.amount,
          currency: sub.currency,
          name: "Meeticulous",
          description: `${sub.from_tier?.name || "Current tier"} → ${tier.name}`,
          handler: async (r) => {
            try {
              await verifyMembershipUpgrade({
                razorpay_order_id: r.razorpay_order_id,
                razorpay_payment_id: r.razorpay_payment_id,
                razorpay_signature: r.razorpay_signature,
              });
              toast.success(`You're on ${tier.name}`);
            } catch (err) {
              toast.error(err?.response?.data?.message || "Payment taken, but the upgrade did not apply. We're on it.");
            }
            await onReload();
          },
          prefill: { name: user?.name, email: user?.email },
          theme: { color: "#960D32" },
        }).open();
        return;
      }

      new window.Razorpay({
        key: sub.key,
        subscription_id: sub.subscription_id,
        name: "Meeticulous",
        description: `${program.name} — ${tier.name} (auto-renews)`,
        handler: async () => {
          try { await syncMembershipSubscription(sub.subscription_id); } catch { /* webhook will catch up */ }
          toast.success(`Membership active — ${tier.name}`);
          await onReload();
        },
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#960D32" },
      }).open();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not join");
    } finally { setJoining(null); }
  };

  return (
    <div>
      {program.cover_url && (
        <img src={program.cover_url} alt={`${program.name || 'Membership'} cover`} className="mb-5 w-full rounded-3xl object-cover" style={{ height: 180, background: ACCENT_LIGHT }} />
      )}
      <ProfileTabHeading eyebrow="Join the" title={program.name || 'Membership'} C={C} />
      {program.blurb && <p className="-mt-3 mb-5 text-sm leading-relaxed" style={{ color: C.secondary }}>{program.blurb}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {tiers.map((t, i) => {
          const current = mine?.tier_id === t.id;
          // What the member holds now decides whether another tier is a move up
          // (allowed, prorated) or down (cancel first — they keep the paid period).
          const heldPrice = mine ? Number(tiers.find((x) => x.id === mine.tier_id)?.price_inr) || 0 : 0;
          const price = Number(t.price_inr) || 0;
          const isUpgrade = !!mine && !current && price > heldPrice;
          const isDowngrade = !!mine && !current && price <= heldPrice;
          return (
            <article key={t.id} id={anchors[i]} className="flex flex-col bg-white rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}`, scrollMarginTop: 90 }}>
              {t.cover_url
                ? <img src={t.cover_url} alt={`${t.name} tier cover`} loading="lazy" decoding="async" className="w-full aspect-[16/9] object-cover" />
                : <div className="w-full flex items-center justify-center" style={{ height: 72, background: ACCENT_LIGHT, color: ACCENT }}><Crown className="w-7 h-7" strokeWidth={1.8} /></div>}
              <div className="flex flex-col gap-3 p-5 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display font-bold text-lg leading-snug" style={{ color: C.text }}>{t.name}</h3>
                  <span className="flex-shrink-0 font-display font-extrabold text-lg leading-none" style={{ color: C.text }}>
                    {t.type === "free" ? "Free" : <>{rupees(t.price_inr)}<span className="font-sans text-xs font-medium" style={{ color: C.muted }}>/month</span></>}
                  </span>
                </div>
                {t.description && <p className="text-sm leading-relaxed" style={{ color: C.secondary }}>{t.description}</p>}
                {t.perks?.length > 0 && (
                  <ul className="space-y-1.5 text-sm" style={{ color: C.secondary }}>
                    {t.perks.map((p, i) => <li key={i} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0" style={{ color: ACCENT }} />{p}</li>)}
                  </ul>
                )}
                <div className="mt-auto pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                  {current ? (
                    <span className="flex items-center justify-center gap-1.5 rounded-full text-sm font-semibold" style={{ height: 40, background: ACCENT_LIGHT, color: ACCENT }}>
                      <Check size={15} /> Current plan
                    </span>
                  ) : isDowngrade ? (
                    <p className="text-center text-xs" style={{ color: C.muted }}>
                      Cancel your current tier to move here — it stays active until the period you have paid for ends.
                    </p>
                  ) : (
                    <button type="button" onClick={() => join(t)} disabled={joining === t.id}
                      className="w-full text-sm font-semibold rounded-full transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-60"
                      style={{ background: ACCENT, color: ACCENT_TEXT, height: 40 }}>
                      {joining === t.id
                        ? (isUpgrade ? "Upgrading…" : "Joining…")
                        : isUpgrade ? `Upgrade · ${rupees(t.price_inr)}/month`
                        : t.type === "free" ? "Join free" : "Join"}
                    </button>
                  )}
                  {isUpgrade && (
                    <p className="mt-2 text-center text-xs" style={{ color: C.muted }}>
                      You pay the difference for the days left on your current tier.
                    </p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {posts.length > 0 && (
        <div className="mt-10 space-y-4">
          <h2 className="font-display font-bold text-xl flex items-center gap-2" style={{ color: C.text }}>
            <Lock size={16} style={{ color: ACCENT }} /> Recent from {host?.name || host?.username}
          </h2>
          {posts.map((p) => <ItemCard key={p.id} item={p} viewerId={user?.id} />)}
        </div>
      )}
    </div>
  );
};
