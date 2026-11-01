import { useEffect } from "react";
import { Link } from "react-router-dom";
import useUtm from "../../hooks/useUtm";
import useDocumentMeta from "../../hooks/useDocumentMeta";
import { analytics, EVENTS } from "../../services/analytics";
import Seo from "../../components/common/Seo";
import { ogCard } from "../../config/ogImages";
import { SITE_URL, comparisonGraphJsonLd } from "../../utils/seo";
import { FAQ as TOPMATE_FAQ, PRICE_LINE, PER_DAY_LINE } from "../../components/lp/lpData";
import { PREMIUM_PLAN } from "../../data/plans";

import { CtaButton } from "../../components/lp/LpKit";
import LpHero from "../../components/lp/LpHero";
import LpCreatorsCarousel from "../../components/lp/LpCreatorsCarousel";
import LpFlash from "../../components/lp/LpFlash";
import LpAccordion from "../../components/lp/LpAccordion";
import LpTestimonials from "../../components/lp/LpTestimonials";
import LpBento from "../../components/lp/LpBento";
import LpCompareTable from "../../components/lp/LpCompareTable";
import LpFaq from "../../components/lp/LpFaq";
import { useHideChrome } from "../../context/ChromeContext";

/* ════════════════════════════════════════════════════════════════════
   /compare/topmate-alternative — Topmate-style conversion landing page.
   Single goal: start a 0%-commission host signup (→ /become-a-host).
   Keeps its own minimal header/footer BY DESIGN (useHideChrome drops the
   global nav) — the founder chose to keep this page's design as is.
   Blocks live in client/src/components/lp/*; content in lpData.js, which
   reads Topmate facts from data/competitors.js and prices from data/plans.js.
   ════════════════════════════════════════════════════════════════════ */

// Analytics slug kept from the old /lp URL so LP_VIEWED / LP_CTA_CLICKED history stays continuous.
const SLUG = "topmate-vs-meeticulous";
const CANONICAL = `${SITE_URL}/compare/topmate-alternative`;
const TITLE = "Topmate Alternative: 0% Commission, UPI + GST | Meeticulous";
const DESCRIPTION = `Meeticulous is a Topmate alternative for Indian creators: 0% commission on ${PREMIUM_PLAN.name} (${PRICE_LINE}), UPI at booking and GST invoices. Compare the fees.`;

const TopmateVsMeeticulous = () => {
  // This page keeps its own minimal header/footer (design unchanged by choice).
  useHideChrome();
  const utm = useUtm();

  useDocumentMeta({ title: TITLE, description: DESCRIPTION });

  useEffect(() => {
    analytics.page({ lp: SLUG });
    analytics.track(EVENTS.LP_VIEWED, { slug: SLUG, ...utm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-dvh overflow-x-hidden bg-canvas text-ink">
      <Seo
        title={TITLE}
        description={DESCRIPTION}
        image={ogCard('lp-topmate-vs-bookasloth')}
        canonical={CANONICAL}
        jsonLd={comparisonGraphJsonLd({
          canonical: CANONICAL,
          name: "Topmate Alternative: 0% Commission, UPI + GST",
          description: DESCRIPTION,
          breadcrumbName: "Topmate Alternative",
          faqs: TOPMATE_FAQ,
        })}
      />
      {/* ───── Minimal header (no nav links = no exit) ───── */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
          <div className="flex items-center gap-2">
            <span className="font-heading text-base font-extrabold tracking-tight text-ink">
              Meeticulous
            </span>
            <span className="hidden rounded-[4px] bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary sm:inline">
              0% commission
            </span>
          </div>
          <CtaButton
            slot="header"
            className="!rounded-[6px] !px-4 !py-2 !text-[13px]"
          >
            Start My Page
          </CtaButton>
        </div>
      </header>

      {/* ───── Blocks ───── */}
      <LpHero />
      <LpCreatorsCarousel />
      <LpFlash />
      <LpAccordion />
      <LpTestimonials />
      <LpBento />
      <LpCompareTable />
      <LpFaq />

      {/* ───── Final CTA ───── */}
      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-4xl rounded-[8px] bg-ink px-6 py-16 text-center text-white sm:py-20">
          <h2 className="mx-auto max-w-xl text-3xl leading-tight text-white sm:text-5xl">
            Stop paying commission on your own work.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-white/60">
            Move to a flat {PRICE_LINE} on {PREMIUM_PLAN.name}, {PER_DAY_LINE}. 0% commission
            from your next booking.
          </p>
          <div className="mt-9 flex justify-center">
            <CtaButton slot="final" variant="light" />
          </div>
        </div>
      </section>

      {/* ───── Minimal footer ───── */}
      <footer className="px-5 pb-10 sm:px-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 border-t border-black/5 pt-8 text-xs text-neutral-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Meeticulous</p>
          <div className="flex items-center gap-5">
            <Link to="/privacy" className="hover:text-ink hover:no-underline">
              Privacy
            </Link>
            <Link to="/help" className="hover:text-ink hover:no-underline">
              Help
            </Link>
            <a href="mailto:hello@meeticulous.com" className="hover:text-ink hover:no-underline">
              hello@meeticulous.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TopmateVsMeeticulous;
