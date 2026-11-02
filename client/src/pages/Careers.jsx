import Seo from '../components/common/Seo';
import { ogCard } from '../config/ogImages';
import useAboutMotion from '../components/about/useAboutMotion';
import CareersHero from '../components/careers/CareersHero';
import WhyWorkHere from '../components/careers/WhyWorkHere';
import CareersFacts from '../components/careers/CareersFacts';
import OpenRoles from '../components/careers/OpenRoles';

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Careers at Meeticulous',
  url: 'https://meeticulous.com/careers',
  description: 'Open roles at Meeticulous — build the calm way to get booked.',
};

export default function Careers() {
  useAboutMotion();
  return (
    // Sequence: split hero → fact strip → why build with us (pastel cards) →
    // open roles (cards). (The "Don't see your role?" CTA band and the "Work that
    // fits your life" Perks section were removed 2026-11-02 at the owner's request.)
    // (The empty-photo CultureStrip was dropped in the 2026-11 redesign.)
    <main className="bg-white">
      <Seo
        title="Careers at Meeticulous — build the calm way to get booked"
        description="Join Meeticulous. Open roles across marketing, engineering, and sales. Remote-first, creators-first."
        image={ogCard('careers')}
        canonical="https://meeticulous.com/careers"
        jsonLd={JSON_LD}
      />
      <CareersHero />
      <CareersFacts />
      <WhyWorkHere />
      <OpenRoles />
    </main>
  );
}
