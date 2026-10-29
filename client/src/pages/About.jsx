import { Link } from "react-router-dom";
import { Heart, Newspaper, Briefcase, LifeBuoy, Mail, Calculator } from "lucide-react";
import Seo from "../components/common/Seo";
import { ogCard } from "../config/ogImages";
import { ORG_SAME_AS, SITE_URL } from "../utils/seo";
import useAboutMotion from "../components/about/useAboutMotion";
import HeroV2 from "../components/about/HeroV2";
import LogoMarquee from "../components/about/LogoMarquee";
import JoinSplit from "../components/about/JoinSplit";
import StackingCards from "../components/about/StackingCards";
import TestimonialsFlip from "../components/about/TestimonialsFlip";
import FaqAccordion from "../components/about/FaqAccordion";
import TeamMasonry from "../components/about/TeamMasonry";
// Appended (kept) original sections:
import BeliefGrid from "../components/about/BeliefGrid";
// Removed: ProblemSplit, BehindProduct, StatStrip, BuildFlow, FinalCta, TrustGrid

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Meeticulous",
  url: "https://meeticulous.com",
  description:
    "Meeticulous helps creators publish services, get booked, and get paid — with 0% commission.",
  sameAs: ORG_SAME_AS,
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
        title="About Meeticulous — the calm way to get booked"
        description="Why we exist, who we are, and how we help creators get booked and paid without commission."
        image={ogCard('about')}
        canonical={`${SITE_URL}/about`}
        jsonLd={JSON_LD}
      />
      {/* Sequence: Hero → Brands → How it works → Team → Belief → Join → Testimonials → FAQ */}
      <HeroV2 />
      <LogoMarquee />
      <StackingCards />
      <TeamMasonry />
      <BeliefGrid />
      <JoinSplit />
      <TestimonialsFlip />
      <FaqAccordion />
      <ExploreMore />
    </main>
  );
}
