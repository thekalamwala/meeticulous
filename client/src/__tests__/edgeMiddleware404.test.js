import { describe, it, expect } from 'vitest';
import { renderProfile404Html } from '../../middleware.js';

describe('edge profile-404 HTML', () => {
  it('is branded, noindex, carries no external art + new copy', () => {
    const html = renderProfile404Html('coolhost');
    expect(html).toContain('name="robots"');
    expect(html).toContain('noindex');
    expect(html).not.toContain('<img');
    expect(html).toContain('No host at this address');
    expect(html).toContain('/coolhost');
    expect(html).toContain('/explore');
  });
  it('sanitizes the slug (no raw angle brackets injected)', () => {
    const html = renderProfile404Html('<script>x');
    expect(html).not.toContain('<script>x');
  });
});
