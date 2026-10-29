/**
 * Open-access window: while OPEN_ACCESS_UNTIL (epoch ms) is in the future,
 * isOpenAccess() is true → every limiter's skip fires and ipGuard stops blocking.
 * Unset / blank / non-numeric / past → false, so normal limits apply.
 */
function loadIsOpen() {
  jest.resetModules();
  return require('../../config/openAccessWindow').isOpenAccess;
}

describe('isOpenAccess', () => {
  const OLD = process.env.OPEN_ACCESS_UNTIL;
  afterEach(() => {
    if (OLD === undefined) delete process.env.OPEN_ACCESS_UNTIL;
    else process.env.OPEN_ACCESS_UNTIL = OLD;
  });

  test('future deadline → open', () => {
    process.env.OPEN_ACCESS_UNTIL = String(Date.now() + 60_000);
    expect(loadIsOpen()()).toBe(true);
  });

  test('past deadline → gated', () => {
    process.env.OPEN_ACCESS_UNTIL = String(Date.now() - 60_000);
    expect(loadIsOpen()()).toBe(false);
  });

  test('unset → gated', () => {
    delete process.env.OPEN_ACCESS_UNTIL;
    expect(loadIsOpen()()).toBe(false);
  });

  test('blank/garbage → gated', () => {
    process.env.OPEN_ACCESS_UNTIL = 'soon';
    expect(loadIsOpen()()).toBe(false);
  });
});
