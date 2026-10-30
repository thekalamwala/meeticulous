import { Link } from "react-router-dom";
import { Heart, Newspaper, Briefcase, LifeBuoy, Mail, Calculator } from "lucide-react";
import Seo from "../components/common/Seo";
import { ogCard } from "../config/ogImages";
import { ORG_SAME_AS, SITE_URL } from "../utils/seo";
import useAboutMotion from "../components/about/useAboutMotion";
import HeroV2 from "../components/about/HeroV2";
import { ProblemSection, MissionBand, AudienceSection, DifferenceSection, FinalCta } from "../components/about/StorySections";
import HostQuotes from "../components/about/HostQuotes";
import FaqAccordion from "../components/about/FaqAccordion";
import TeamMasonry from "../components/about/TeamMasonry";
import BeliefGrid from "../components/about/BeliefGrid";
import { faq } from "../components/about/aboutContent";
// Removed (2026-10 About rework): LogoMarquee (third-party brand logos implied
// endorsement), StackingCards (duplicated the homepage feature tour), JoinSplit
// (Careers stays reachable via "More from Meeticulous").

// Organization + FAQPage. The description must stay true for every plan — the
// free plan takes a commission, so "0% commission" is not an org-level claim.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Meeticulous",
      url: "https://meeticulous.com",
      description:
        "Meeticulous is an online booking platform for creators, pros & bros: publish your services, take bookings, collect payment upfront and send reminders automatically.",
      sameAs: ORG_SAME_AS,
    },
    {
      "@type": "FAQPage",
      mainEntity: faq.items.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

// Company / "more from Meeticulous" links. These moved off the footer's old
// discovery columns onto About, which keeps them crawlable in static HTML (About
// is prerendered) so pages like Wall of Love and Careers aren't SEO-orphaned.
const EXPLORE = [
  { t: "Wall of Love", href: "/wall-of-love", desc: "Real words from hosts who get booked with us.", Icon: Heart, accent: "var(--c-pink)" },
  { t: "Blog", href: "/blog", desc: "Guides on getting booked, pricing and growth.", Icon: Newspaper, accent: "var(--c-blue)" },
  { t: "Careers", href: "/careers", desc: "Help us build the calm way to get booked.", Icon: Briefcase, accent: "var(--c-violet)" },
  { t: "Help center", href: "/help", desc: "Answers, docs and setup walkthroughs.", Icon: LifeBuoy, accent: "var(--c-emerald)" },
  { t: "Contact", href: "/contact", desc: "Talk to a human on the Meeticulous team.", Icon: Mail, accent: "var(--c-cyan)" },
  { t: "Earnings calculator", href: "/earnings-calculator", desc: "See what you’d take home on Meeticulous.", Icon: Calculator, accent: "var(--c-amber)" },
];

function ExploreMore() {
  return (
    <section className="px-5 py-12 sm:px-8 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-heading text-3xl font-bold sm:text-4xl">More from Meeticulous</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {EXPLORE.map(({ t, href, desc, Icon, accent }) => (
            <Link
              key={href}
              to={href}
              className="js-item rounded-[6px] border border-ink/10 bg-surface p-6 transition-transform duration-150 hover:-translate-y-1 hover:no-underline"
            >
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-[6px]"
                style={{ background: `color-mix(in srgb, ${accent} 14%, white)`, color: accent }}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-heading text-lg font-semibold">{t}</h3>
              <p className="mt-1 text-ink/70">{desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function About() {
  useAboutMotion();
  return (
    <main className="bg-[var(--bg)]">
      <Seo
        title="About Meeticulous — Online Booking Platform for Creators, Pros & Bros"
        description="Why Meeticulous exists: appointment booking software that lets creators and professionals sell their time — bookings, upfront payments and reminders in one place."
        image={ogCard('about')}
        canonical={`${SITE_URL}/about`}
        jsonLd={JSON_LD}
      />
      {/* Sequence: Hero → Why we built it → Mission → Who it's for → How we're
          different → Beliefs → Team → Host quotes → FAQ → Final CTA → More links */}
      <HeroV2 />
      <ProblemSection />
      <MissionBand />
      <AudienceSection />
      <DifferenceSection />
      <BeliefGrid />
      <TeamMasonry />
      <HostQuotes />
      <FaqAccordion />
      <FinalCta />
      <ExploreMore />
    </main>
  );
}
