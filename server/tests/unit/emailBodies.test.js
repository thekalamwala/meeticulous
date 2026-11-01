/**
 * tests/unit/emailBodies.test.js
 * Integration: every seeded template renders with no leftover {{tokens}}, the CTA
 * stays brand crimson, and category hero blocks appear. Renders via the pure
 * resolver + layout (mirrors communicationEngine.renderEmail) so no DB is needed.
 */
'use strict';

const TEMPLATES = require('../../config/emailTemplates');
const { buildGlobals, resolveTemplate, resolveString } = require('../../services/email/placeholderResolver');
const { renderLayout } = require('../../services/email/emailLayout');

const settings = {
  brand_color: '#FE5100', from_name: 'Meeticulous', logo_url: 'https://cdn.test/x.png',
  website_url: 'https://meeticulous.com', support_email: 's@x.test',
};

const data = {
  otp: '131289',
  booking_date: 'Mon, 16 Feb 2026', booking_time: '10:15 AM',
  booking_day: '16', booking_month: 'FEB', booking_year: '2026',
  service_name: 'Career Direction Consultation', vendor_name: 'Shubham', user_name: 'Naman',
  plan_name: 'Pro', expiry_date: '1 Mar 2026', badge_name: 'Top Pick', badge_description: 'Awarded for quality.',
  milestone_value: '10', completion_percentage: '80', verification_status: 'approved',
  feedback_subject: 'Dark mode please', status_label: 'Reviewing', admin_response: 'On our roadmap.',
  login_time: 'now', ip_address: '1.1.1.1', device_name: 'Chrome on Mac', location: 'Online',
  action_label: 'Join meeting', action_link: 'https://meeticulous.com/x',
  manage_url: 'https://meeticulous.com/manage-booking/tok',
  booking_ref: '1A2B3C4D',
};

// Mirror of communicationEngine.renderEmail (kept DB-free for unit testing).
function render(template, audience) {
  const globals = buildGlobals(settings, { name: 'Naman Acharya', email: 'n@x.com', username: 'naman' });
  const r = resolveTemplate(template, data, globals);
  const previewText = resolveString(template.preview_text || '', { ...globals, ...data }).text;
  return renderLayout({
    audience, bodyHtml: r.html, previewText,
    ctaLabel: r.ctaLabel, ctaUrl: r.ctaUrl, emailCategory: template.email_category || '', settings, data,
  });
}

describe('email bodies — full render', () => {
  test('no template leaks a raw {{token}}; CTA is brand orange when present', () => {
    for (const t of TEMPLATES) {
      const html = render(t, t.audience);
      expect(html).not.toMatch(/\{\{[a-z0-9_]+\}\}/i);
      if (t.cta_label && t.cta_url) expect(html).toContain('#FE5100');
    }
  });

  test('OTP email shows the otpBox in the crimson tint', () => {
    const otp = TEMPLATES.find((x) => x.event_key === 'BOOKING_OTP');
    const html = render(otp, 'all');
    expect(html).toContain('131289');
    expect(html).toContain('#FBE3E8'); // crimson tint
  });

  test('Booking confirmed shows the booking ref, booking card and one status pill', () => {
    const bc = TEMPLATES.find((x) => x.event_key === 'BOOKING_CONFIRMED_CUSTOMER');
    const html = render(bc, 'all');
    expect(html).toContain('Booking #1A2B3C4D');                       // ref above the title
    expect(html).toContain('meeticulous-icon-color-512.png');          // mark in the card header
    expect(html).toContain('Career Direction Consultation');
    expect(html).toContain('Mon, 16 Feb 2026');
    expect(html.match(/Booking Confirmed/g)).toHaveLength(1);          // header pill only
  });

  test('no template carries a second palette (green/orange/slate)', () => {
    for (const t of TEMPLATES) {
      const html = render(t, t.audience);
      expect(html).not.toMatch(/#1aa463|#056800|#e8fff1|#b8410f|#fff4ed|#41506a|#eef1f5/i);
    }
  });
});
