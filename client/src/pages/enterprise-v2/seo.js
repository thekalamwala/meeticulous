// SEO for /enterprise. Ported from the previous pages/enterprise/enterpriseSeo.js
// so the head tags + JSON-LD survive the design swap. FAQ copy is imported from
// the FAQ component (single source of truth) to feed faqJsonLd.
import { SITE_URL, organizationJsonLd, faqJsonLd, breadcrumbJsonLd } from '../../utils/seo';
import { faqs } from './components/FAQ';

const URL = `${SITE_URL}/enterprise`;

export const ENT_SEO = {
  title: 'Enterprise Appointment Booking App | Meeticulous Enterprise',
  description: 'Meeticulous Enterprise is an appointment booking app for organizations — configurable calendars, multiple locations, role-based access, payments, and integrations, built around your workflow.',
  canonical: URL,
  keywords: 'appointment booking app, enterprise appointment booking app, enterprise scheduling software, appointment booking software, multi-location booking software, franchise scheduling software, business scheduling platform',
  ogTitle: 'Enterprise Appointment Booking App — Meeticulous Enterprise',
  ogDescription: 'Booking infrastructure for organizations with multiple teams, locations, and workflows.',
};

const softwareApplicationJsonLd = () => ({
  '@type': 'SoftwareApplication',
  name: 'Meeticulous Enterprise',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: URL,
  description: ENT_SEO.description,
  // No aggregateRating/review — do not fabricate.
});

// Each shared builder returns a full {'@context', '@type', ...} document; strip
// '@context' before nesting multiple nodes under one shared '@graph'.
const stripContext = ({ '@context': _ctx, ...rest }) => rest;

export function buildEnterpriseJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      stripContext(organizationJsonLd({ siteUrl: SITE_URL })),
      softwareApplicationJsonLd(),
      stripContext(faqJsonLd({ faqs })),
      stripContext(breadcrumbJsonLd({
        siteUrl: SITE_URL,
        items: [
          { name: 'Home', path: '/' },
          { name: 'Enterprise', path: '/enterprise' },
        ],
      })),
    ],
  };
}
