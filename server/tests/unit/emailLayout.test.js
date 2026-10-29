/**
 * tests/unit/emailLayout.test.js
 * Redesigned header: constant Book a Sloth logo (left) + accent category pill
 * (right), identical across audiences. The customer/vendor distinction now lives
 * ONLY in the footer (unchanged by the redesign — guarded below).
 */
'use strict';

const { renderLayout } = require('../../services/email/emailLayout');

const settings = {
  brand_color: '#FE5100',
  website_url: 'https://x.test',
  support_email: 's@x.test',
  from_name: 'Book A Sloth',
  logo_url: 'https://cdn.test/bas-logo.png',
};

describe('renderLayout — header (logo left, accent pill right)', () => {
  for (const audience of ['customer', 'vendor']) {
    test(`${audience}: footer-logo on the left + accent category pill on the right`, () => {
      const html = renderLayout({ audience, bodyHtml: '<p>hi</p>', emailCategory: 'Booking Confirmed', settings, data: {} });
      expect(html).toContain('images/email/footer-logo.png');          // constant left logo
      expect(html).toContain('Booking Confirmed');                     // pill label
      expect(html).toContain('#e8fff1');                               // green tint (pill bg)
      expect(html).toContain('images/email/icons/calendar-check.png'); // glyph PNG
      expect(html).toContain('border-radius:1px');                     // squared pill (radius capped at 1px)
    });
  }

  test('pill degrades to text-only when the category has no glyph', () => {
    const html = renderLayout({ audience: 'customer', bodyHtml: '<p>hi</p>', emailCategory: 'Nope', settings, data: {} });
    expect(html).toContain('Nope');
    expect(html).not.toContain('/icons/.png'); // no broken-image src
  });
});

describe('renderLayout — footer distinction (UNCHANGED by redesign)', () => {
  test("audience 'vendor' → minimal Powered-by footer, no customer nav", () => {
    const html = renderLayout({ audience: 'vendor', bodyHtml: '<p>hi</p>', emailCategory: 'New Booking', settings, data: {} });
    expect(html).toMatch(/Powered by/i);
    expect(html).not.toMatch(/My Bookings/i);
    expect(html).not.toMatch(/Unsubscribe/i);
  });

  test("audience 'customer' → nav + legal footer, no Powered by", () => {
    const html = renderLayout({ audience: 'customer', bodyHtml: '<p>hi</p>', emailCategory: 'Booking Confirmed', settings, data: {} });
    expect(html).toMatch(/My Bookings/i);
    expect(html).toMatch(/Help/i);
    expect(html).toMatch(/Privacy/i);
    expect(html).toMatch(/Unsubscribe/i);
    expect(html).not.toMatch(/Powered by/i);
  });

  test("audience 'all' and missing → customer footer (safe default with unsubscribe)", () => {
    expect(renderLayout({ audience: 'all', bodyHtml: '<p>hi</p>', settings, data: {} })).toMatch(/My Bookings/i);
    expect(renderLayout({ bodyHtml: '<p>hi</p>', settings, data: {} })).toMatch(/Unsubscribe/i);
  });

  test('customer footer uses real routes and carries the unsubscribe token from data', () => {
    const html = renderLayout({ audience: 'customer', bodyHtml: '', settings, data: { unsubscribe_token: 'TOK123' } });
    expect(html).toContain('https://x.test/user/my-bookings');
    expect(html).toContain('https://x.test/help');
    expect(html).toContain('https://x.test/privacy');
    expect(html).toContain('https://x.test/unsubscribe?u=TOK123');
  });
});

describe("renderLayout — cold outreach layout", () => {
  test("audience 'cold' → no header chrome, legal-floor footer only", () => {
    const html = renderLayout({ audience: 'cold', bodyHtml: '<p>hi</p>', emailCategory: 'Booking Confirmed', settings, data: { unsubscribe_token: 'TOK123' } });
    // legal floor present
    expect(html).toMatch(/Unsubscribe/i);
    expect(html).toContain('https://x.test/unsubscribe?u=TOK123');
    expect(html).toContain('Timewheel');            // legal entity sign-off
    expect(html).toContain('Book A Sloth');         // sender identity in the footer
    expect(html).toContain('Nagpur');               // postal address (legal floor)
    // plain hand-typed look: white ground, left-aligned, no grey card, no 600px shell
    expect(html).toContain('background:#ffffff');
    expect(html).not.toContain('#f3f5f7');          // no grey page background
    expect(html).not.toContain('width:600px');       // no centered card
    // header chrome + customer clutter stripped
    expect(html).not.toContain('images/email/header-logo.png');
    expect(html).not.toContain('images/email/footer-logo.png');
    expect(html).not.toMatch(/Booking Confirmed/);  // no category pill
    expect(html).not.toMatch(/My Bookings/i);
    expect(html).not.toMatch(/Powered by/i);
    expect(html).not.toMatch(/All rights reserved/i);
    expect(html).not.toContain('height:4px;line-height:4px'); // no orange accent bar
    expect(html).toContain('<p>hi</p>');            // body still injected
  });
});

describe('renderLayout — shared structure', () => {
  test('both layouts carry the 4px brand accent and the 600px card with the body', () => {
    for (const audience of ['customer', 'vendor']) {
      const html = renderLayout({ audience, bodyHtml: '<p>x</p>', emailCategory: 'New Booking', settings, data: {} });
      expect(html).toContain('#FE5100'); // accent bar / CTA brand
      expect(html).toContain('600');     // card width
      expect(html).toContain('<p>x</p>'); // body injected
    }
  });

  test('CTA renders only when both label and url present', () => {
    const withCta = renderLayout({ audience: 'customer', bodyHtml: '', ctaLabel: 'View', ctaUrl: 'https://x.test/b', settings, data: {} });
    expect(withCta).toContain('https://x.test/b');
    expect(withCta).toMatch(/View/);

    const noCta = renderLayout({ audience: 'customer', bodyHtml: '', ctaLabel: 'View', ctaUrl: '', settings, data: {} });
    expect(noCta).not.toMatch(/>View</);
  });
});
