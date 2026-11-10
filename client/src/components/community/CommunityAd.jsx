import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { analytics, EVENTS } from '../../services/analytics';
import { TESTIMONIALS } from '../../data/testimonials';

// Real, consented host testimonials (single source of truth; see data/testimonials.js —
// FTC/ASCI: genuine quotes only, no invented numbers). Picked by name so a quote pulled
// for consent reasons surfaces here instead of silently drifting.
const testimonial = (name) => TESTIMONIALS.find((t) => t.name === name) || TESTIMONIALS[0];

// Sidebar ad slot. The audience decides the deck: a Pro host is sold reach, a free host
// is sold Pro, and everyone else (guest / logged-out) is sold "become a host, get paid".
// One variant shows at a time, re-picked at random on every mount (refresh) and every 60s.
// The card is a FIXED 320×440 box whatever the variant, so rotation never shifts the rail.
// Every variant carries a unique `code` → tracked on impression + click.

const PAID = new Set(['premium', 'professional', 'supreme']);
const isProPlan = (plan) => PAID.has(String(plan || '').toLowerCase());
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

const DISMISS_KEY = 'mt_community_ad_dismissed'; // per-tab: hide for this session only
const dismissedThisSession = () => {
  try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
};

// Scoped styles (mtad- prefix, self-contained hex) so the card matches the approved design
// exactly without depending on Tailwind/brand.css class names. Injected once by the component.
const AD_CSS = `
.mtad{position:relative;width:100%;max-width:320px;height:440px;overflow:hidden;border-radius:22px;border:1px solid #EADFD8;box-shadow:0 12px 32px rgba(150,13,50,.14);padding:18px;background:#fff;display:flex;flex-direction:column;gap:12px;font-family:Poppins,system-ui,sans-serif}
.mtad.mtad--maroon{border-color:#6E0A26;color:#fff;background:#960D32}
.mtad.mtad--maroon .mtad-muted,.mtad.mtad--maroon .mtad-fine{color:#F3C9D5}
.mtad-strip{position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,#960D32,#C64A6B,#F2A900)}
.mtad--maroon .mtad-strip{background:linear-gradient(90deg,#F2A900,#E58BA3,#fff)}
.mtad-flag{display:flex;align-items:center;justify-content:space-between;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#8A6B72}
.mtad--maroon .mtad-flag{color:#F3C9D5}
.mtad-flag .l{display:flex;align-items:center;gap:6px}.mtad-flag .l i{width:6px;height:6px;border-radius:50%;background:#F2A900}
.mtad-x{cursor:pointer;background:none;border:0;color:inherit;font-size:16px;line-height:1;padding:0}
.mtad-content{display:flex;flex-direction:column;flex:1;min-height:0}
.mtad-content.center{align-items:center;text-align:center}
.mtad-ee{flex:1;position:relative;display:flex;align-items:center;justify-content:center;margin:4px -18px;min-height:76px;overflow:hidden}
.mtad-ee svg{height:105px;width:auto;color:#E58BA3;flex:0 0 auto;transform:rotate(-12.5deg) scale(1.06)}
.mtad-btn{display:block;width:100%;text-align:center;text-transform:capitalize;border:0;border-radius:999px;padding:12px;font-family:Poppins;font-weight:700;font-size:14px;cursor:pointer;background:#960D32;color:#fff;text-decoration:none}
.mtad-btn--light{display:block;width:100%;text-align:center;text-transform:capitalize;border:0;border-radius:999px;padding:12px;font-family:Poppins;font-weight:700;font-size:14px;cursor:pointer;background:#fff;color:#960D32}
.mtad-btn--out{display:block;width:100%;text-align:center;text-transform:capitalize;border:1.5px solid #960D32;border-radius:999px;padding:11px;font-family:Poppins;font-weight:600;font-size:14px;cursor:pointer;background:transparent;color:#960D32}
.mtad-qm{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:46px;line-height:.4;color:#960D32}
.mtad-quote{font-family:"Bricolage Grotesque",sans-serif;font-weight:700;font-size:16.5px;line-height:1.3;letter-spacing:-.01em;margin:10px 0 0;color:#2A1216}
.mtad-by{display:flex;align-items:center;gap:10px;margin-top:13px}
.mtad-by .av{width:38px;height:38px;border-radius:50%;background:radial-gradient(circle at 30% 25%,#E58BA3,#960D32);flex:0 0 auto;background-size:cover;background-position:center}
.mtad-by b{display:block;font-size:12px;color:#2A1216}.mtad-by span{font-size:10.5px;color:#8A6B72}
.mtad-chip{display:inline-flex;align-items:center;gap:5px;align-self:flex-start;margin-top:11px;background:#F7E4E9;color:#960D32;font-size:11px;font-weight:700;padding:5px 11px;border-radius:999px}
.mtad-pill{display:inline-block;font-size:10.5px;font-weight:700;background:#F2A900;color:#2A1216;padding:3px 11px;border-radius:999px;text-transform:uppercase;letter-spacing:.03em}
.mtad-bigH{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:24px;line-height:1.1;letter-spacing:-.02em;margin:12px 0 6px;color:#2A1216}
.mtad-bigH .q{font-family:"Instrument Serif",serif;font-style:italic;font-weight:400;color:#960D32}
.mtad-muted{font-size:12.5px;color:#8A6B72}
.mtad-price{display:flex;align-items:baseline;gap:10px;justify-content:center;margin-top:10px}
.mtad-price .old{color:#8A6B72;text-decoration:line-through;font-size:15px}
.mtad-price .new{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:30px;color:#960D32}
.mtad-price .per{font-size:11px;color:#8A6B72}
.mtad-avRing{position:relative;width:74px;height:74px;border-radius:50%;padding:3px;margin:2px auto 0;background:conic-gradient(from 210deg,#F2A900,#E58BA3,#960D32,#F2A900)}
.mtad-avRing .ph{width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 30% 25%,#E58BA3,#960D32);border:2px solid #fff;background-size:cover;background-position:center}
.mtad-avBadge{position:absolute;right:-8px;bottom:-2px;background:#F2A900;color:#2A1216;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;padding:2px 8px;border-radius:999px;border:2px solid #fff}
.mtad-heroH{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:27px;line-height:1.05;letter-spacing:-.025em;color:#fff;margin:8px 0 0}
.mtad-heroH .q{font-family:"Instrument Serif",serif;font-style:italic;font-weight:400;color:#E58BA3}
.mtad-heroSub{font-size:12.5px;color:#F3C9D5;margin:9px 0 0;max-width:26ch}
.mtad-adsby{font-size:10px;color:#F3C9D5;text-align:center;margin-top:10px;letter-spacing:.02em}
`;

const EE_D = 'M-200,130 L0,130 C40,130 70,128 95,110 C125,88 135,50 105,40 C70,30 40,75 45,120 C50,175 95,195 140,170 C170,150 200,110 225,95 C255,72 265,40 235,35 C200,30 172,75 178,120 C185,170 230,195 280,175 C320,160 360,150 400,150 L600,150';
const Ribbon = () => (
  <div className="mtad-ee" aria-hidden="true">
    <svg viewBox="-200 0 800 220" preserveAspectRatio="xMidYMid meet"><path d={EE_D} fill="none" stroke="currentColor" strokeWidth="37" strokeLinecap="round" /></svg>
  </div>
);
const Quote = ({ children }) => (<><div className="mtad-qm" aria-hidden="true">&ldquo;</div><p className="mtad-quote">{children}</p></>);
const By = ({ name, role, avatar }) => (
  <div className="mtad-by"><span className="av" style={avatar ? { backgroundImage: `url(${avatar})` } : undefined} /><div><b>{name}</b><span>{role}</span></div></div>
);
// Each variant: { code, maroon?, render({ user, cta }) }. cta(code) does track + action.
const UPGRADE = [
  { code: 'upgrade_testimonial', render: ({ cta }) => {
    const t = testimonial('Arjun Ravikumar'); // 0% commission -> keep-your-money angle for Pro
    return (
      <div className="mtad-content">
        <div><Quote>{t.quote}</Quote><By name={t.name} role={t.role} avatar={t.avatar} /></div>
        <Ribbon /><button type="button" className="mtad-btn" onClick={cta}>Go Pro</button>
      </div>
    );
  } },
  { code: 'upgrade_price', render: ({ cta }) => (
    <div className="mtad-content center">
      <div><span className="mtad-pill">2 founding spots left</span><h3 className="mtad-bigH">Keep every rupee <span className="q">you earn.</span></h3><p className="mtad-muted">0% platform fee on every booking — forever, on Pro.</p><div className="mtad-price"><span className="old">₹1,499</span><span className="new">₹999</span><span className="per">/mo</span></div></div>
      <Ribbon /><button type="button" className="mtad-btn" onClick={cta}>Claim founding price</button>
    </div>
  ) },
  { code: 'upgrade_personal', render: ({ user, cta }) => (
    <div className="mtad-content center">
      <div><div className="mtad-avRing"><div className="ph" style={user?.avatar_url ? { backgroundImage: `url(${user.avatar_url})` } : undefined} /><span className="mtad-avBadge">Pro</span></div><h3 className="mtad-bigH" style={{ marginTop: 12 }}>Keep 100% of <span className="q">every booking.</span></h3><p className="mtad-muted"><b>{firstName(user?.name)}</b>, Starter takes a cut. Pro makes it zero — and puts you first on Explore.</p></div>
      <Ribbon /><button type="button" className="mtad-btn" onClick={cta}>Try Pro free for 14 days</button>
    </div>
  ) },
];

const ADVERTISE = [
  // Only the capability pitch for now: the paid "feature my page" product doesn't exist yet,
  // so there is no genuine host testimonial for it — adding a fabricated one would be unlawful.
  { code: 'advertise_capability', maroon: true, render: ({ cta }) => (
    <div className="mtad-content">
      <div><h3 className="mtad-heroH">Get in front of <span className="q">every host &amp; guest.</span></h3><p className="mtad-heroSub">Pin your page to the top of the feed. Pay only for the days you run.</p></div>
      <Ribbon /><button type="button" className="mtad-btn--light" onClick={cta}>Feature my page</button><div className="mtad-adsby">Ads by meeticulous.com</div>
    </div>
  ) },
];

const GUEST = [
  { code: 'guest_testimonial', render: ({ cta }) => {
    const t = testimonial('Sangharata Somkuvar'); // set-up-once, money-comes-in -> become-a-host angle
    return (
      <div className="mtad-content">
        <div><Quote>{t.quote}</Quote><By name={t.name} role={t.role} avatar={t.avatar} /></div>
        <Ribbon /><button type="button" className="mtad-btn" onClick={cta}>Start earning</button>
      </div>
    );
  } },
  { code: 'guest_value', render: ({ cta }) => (
    <div className="mtad-content center">
      <div><span className="mtad-pill">Free to start</span><h3 className="mtad-bigH">Turn your time <span className="q">into income.</span></h3><p className="mtad-muted">List your services, get discovered, and take bookings &amp; payments in one place.</p></div>
      <Ribbon /><button type="button" className="mtad-btn" onClick={cta}>Become a host — free</button>
    </div>
  ) },
  { code: 'guest_capability', maroon: true, render: ({ cta }) => (
    <div className="mtad-content">
      <div><h3 className="mtad-heroH">Get paid for what you <span className="q">already do.</span></h3><p className="mtad-heroSub">Your own booking page, calendar and payments — ready in minutes.</p></div>
      <Ribbon /><button type="button" className="mtad-btn--light" onClick={cta}>Sign up free</button><div className="mtad-adsby">Ads by meeticulous.com</div>
    </div>
  ) },
];

const DECKS = { advertise: ADVERTISE, upgrade: UPGRADE, guest: GUEST };
const FLAG = { advertise: 'Grow on Pro', upgrade: 'Upgrade', guest: 'Meeticulous' };
const pick = (deck) => deck[Math.floor(Math.random() * deck.length)];

export default function CommunityAd() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(dismissedThisSession);

  // Pro host -> sell reach; free host -> sell Pro; everyone else (guest / logged-out) -> sell hosting.
  const audience = !user?.is_host ? 'guest' : (isProPlan(user?.plan) ? 'advertise' : 'upgrade');
  const deck = DECKS[audience];

  const [variant, setVariant] = useState(() => pick(deck));
  useEffect(() => {
    setVariant(pick(deck)); // audience changed (plan loaded) -> re-pick from the right deck
    const t = setInterval(() => setVariant(pick(deck)), 60_000);
    return () => clearInterval(t);
  }, [audience]); // eslint-disable-line react-hooks/exhaustive-deps

  const show = !dismissed; // every audience has a deck now (incl. logged-out guests)

  useEffect(() => {
    if (show) analytics.track(EVENTS.COMMUNITY_AD_IMPRESSION, { ad_code: variant.code, audience });
  }, [show, variant.code, audience]);

  const cta = useMemo(() => () => {
    analytics.track(EVENTS.COMMUNITY_AD_CLICKED, { ad_code: variant.code, audience });
    if (audience === 'upgrade') navigate(`/dashboard/upgrade?src=community_ad_${variant.code}`);
    else if (audience === 'guest') navigate(`/become-a-host?src=community_ad_${variant.code}`);
    // ponytail: v1 ad-slot has no self-serve flow yet — capture intent, wire the real flow when ad pricing is set.
    else toast.success("Thanks — we'll reach out about featuring your page.");
  }, [variant.code, audience, navigate]);

  const onDismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  if (!show) return null;
  return (
    <>
      <style>{AD_CSS}</style>
      <div className={`mtad${variant.maroon ? ' mtad--maroon' : ''}`} aria-label="Sponsored">
        <div className="mtad-strip" aria-hidden="true" />
        <div className="mtad-flag">
          <span className="l"><i aria-hidden="true" />{FLAG[audience]}</span>
          <button type="button" className="mtad-x" aria-label="Hide this" onClick={onDismiss}>⋯</button>
        </div>
        {variant.render({ user, cta })}
      </div>
    </>
  );
}
