import Seo from "../components/common/Seo";
import { ogCard } from "../config/ogImages";
import { ORG_SAME_AS, SITE_URL } from "../utils/seo";
import useAboutMotion from "../components/about/useAboutMotion";
import HeroV2 from "../components/about/HeroV2";
import { ProblemSection, MissionBand, DifferenceSection } from "../components/about/StorySections";
import HostQuotes from "../components/about/HostQuotes";
import FaqAccordion from "../components/about/FaqAccordion";
import TeamMasonry from "../components/about/TeamMasonry";
import BeliefGrid from "../components/about/BeliefGrid";
import WorkGallery from "../components/about/WorkGallery";
import { faq } from "../components/about/aboutContent";
// Removed (2026-10 About rework): LogoMarquee (third-party brand logos implied
// endorsement), StackingCards (duplicated the homepage feature tour), JoinSplit
// (Careers stays reachable via the team section + footer). The "More from
// Meeticulous" link grid was removed 2026-10-31 at the owner's request.

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

export default function About() {
  useAboutMotion();
  return (
    // About page background is plain white (owner request 2026-10-31) — not the
    // site-wide --bg/canvas tint, which is a pale pink after the crimson rebrand.
    <main className="bg-white">
      <Seo
        title="About Meeticulous — Online Booking Platform for Creators, Pros & Bros"
        description="Why Meeticulous exists: appointment booking software that lets creators and professionals sell their time — bookings, upfront payments and reminders in one place."
        image={ogCard('about')}
        canonical={`${SITE_URL}/about`}
        jsonLd={JSON_LD}
      />
      {/* Sequence: Hero → Why we built it → Mission → How we're different →
          Team → Gallery (polaroid line) → Beliefs → Host quotes → FAQ.
          ("Who it's for" and the closing "Make your time bookable." CTA were
          removed 2026-10-31 at the owner's request; Beliefs moved after Team.) */}
      <HeroV2 />
      <ProblemSection />
      <MissionBand />
      <DifferenceSection />
      <TeamMasonry />
      <WorkGallery />
      <BeliefGrid />
      <HostQuotes />
      <FaqAccordion />
    </main>
  );
}
