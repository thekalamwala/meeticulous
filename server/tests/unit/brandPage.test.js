const { brandPage, statusPage, wantsBrandedHtml } = require('../../utils/brandPage');

// Fake req: `accepts(['json','html'])` returns the best match for the given
// Accept header, mirroring Express. Browsers → 'html'; curl `*/*` → 'json'.
const req = (path, acceptHtml) => ({
  path,
  accepts: (types) => (acceptHtml ? 'html' : types[0]),
});

describe('wantsBrandedHtml', () => {
  it('serves HTML to a browser on a non-API, non-ops path', () => {
    expect(wantsBrandedHtml(req('/', true))).toBe(true);
    expect(wantsBrandedHtml(req('/anything', true))).toBe(true);
  });

  it('never serves HTML for /api/* (API clients need JSON)', () => {
    expect(wantsBrandedHtml(req('/api/blogs', true))).toBe(false);
    expect(wantsBrandedHtml(req('/api', true))).toBe(false);
  });

  it('never serves HTML for machine endpoints', () => {
    for (const p of ['/health', '/ready', '/metrics', '/robots.txt']) {
      expect(wantsBrandedHtml(req(p, true))).toBe(false);
    }
  });

  it('serves JSON (not HTML) to non-browser clients like curl', () => {
    expect(wantsBrandedHtml(req('/', false))).toBe(false);
  });
});

describe('brandPage', () => {
  it('renders a full HTML doc with the heading and body', () => {
    const html = brandPage({ code: 404, heading: 'Took a nap', body: 'Not found here.' });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Took a nap');
    expect(html).toContain('Not found here.');
    expect(html).toContain('404');
    expect(html).toContain('Meeticulous');
  });

  it('escapes dynamic text to prevent XSS from error messages', () => {
    const html = brandPage({ heading: 'x', body: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('brandPage hero mark', () => {
  it('renders the inline Meeticulous mark when hero is set', () => {
    const html = brandPage({ code: 404, heading: 'h', body: 'b', hero: true });
    expect(html).toContain('class="heromark"');
    expect(html).toContain('aria-label="Meeticulous"');
  });
  it('renders no hero mark by default', () => {
    const html = brandPage({ code: 500, heading: 'h', body: 'b' });
    expect(html).not.toContain('class="heromark"');
  });
  it('never references the dead mascot host', () => {
    const html = brandPage({ code: 404, heading: 'h', body: 'b', hero: true });
    expect(html).not.toContain('company-assets.');
    expect(html).not.toContain('<img');
  });
});

const errorHandler = require('../../middleware/errorMiddleware');

// Minimal Express res/req doubles.
const makeRes = () => {
  const res = { statusCode: 404, headers: {}, body: '' };
  res.status = (c) => { res.statusCode = c; return res; };
  res.type = () => res;
  res.send = (b) => { res.body = b; return res; };
  res.json = (o) => { res.body = JSON.stringify(o); return res; };
  return res;
};
const htmlReq = { originalUrl: '/nope', method: 'GET', path: '/nope', accepts: () => 'html' };

describe('errorMiddleware 404 branding', () => {
  it('renders the Meeticulous mark + vanishing-act copy on a browser 404', () => {
    const res = makeRes();
    errorHandler(Object.assign(new Error('x'), { expose: false }), htmlReq, res, () => {});
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('class="heromark"');
    expect(res.body).not.toContain('company-assets.');
    expect(res.body).toContain('This page pulled a vanishing act');
  });

  it('gives 410 the same hero-mark treatment as 404', () => {
    const res = makeRes();
    res.statusCode = 410;
    errorHandler(Object.assign(new Error('x'), { expose: false }), htmlReq, res, () => {});
    expect(res.statusCode).toBe(410);
    expect(res.body).toContain('class="heromark"');
    expect(res.body).toContain('This page pulled a vanishing act');
  });
});

describe('statusPage', () => {
  it('shows all-operational + Ready when the DB is reachable', () => {
    const html = statusPage({ db: true, uptimeSec: 3661 });
    expect(html).toContain('All systems operational');
    expect(html).toContain('Ready');
    expect(html).toContain('1h 1m'); // uptime formatted
    expect(html).toContain('dot ok');
  });

  it('shows partial-outage + Unreachable when the DB check fails', () => {
    const html = statusPage({ db: false, uptimeSec: 0 });
    expect(html).toContain('Partial outage');
    expect(html).toContain('Unreachable');
    expect(html).toContain('dot bad');
  });
});
