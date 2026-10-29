// Unit tests for the Sentry wrapper. The SDK is mocked; no network, no DSN
// needed. Verifies the no-op-when-disabled contract and the enabled forwarding.

const mockSentry = {
  init: jest.fn(),
  captureException: jest.fn(),
  flush: jest.fn().mockResolvedValue(true),
};
jest.mock('@sentry/node', () => mockSentry);

const OLD_ENV = process.env;

function loadFresh(env = {}) {
  jest.resetModules();
  process.env = { ...OLD_ENV, ...env };
  delete process.env.SENTRY_DSN; // start disabled unless a test sets it
  Object.assign(process.env, env);
  return require('../../utils/sentry');
}

beforeEach(() => {
  mockSentry.init.mockClear();
  mockSentry.captureException.mockClear();
  mockSentry.flush.mockClear();
});
afterAll(() => { process.env = OLD_ENV; });

describe('sentry wrapper — disabled (no DSN)', () => {
  test('initSentry returns enabled:false and never touches the SDK', () => {
    const { initSentry } = loadFresh({ SENTRY_DSN: '' });
    expect(initSentry()).toEqual({ enabled: false });
    expect(mockSentry.init).not.toHaveBeenCalled();
  });

  test('captureException is a safe no-op returning false', () => {
    const { initSentry, captureException } = loadFresh({ SENTRY_DSN: '' });
    initSentry();
    expect(captureException(new Error('boom'))).toBe(false);
    expect(mockSentry.captureException).not.toHaveBeenCalled();
  });

  test('flushSentry resolves without error when disabled', async () => {
    const { flushSentry } = loadFresh({ SENTRY_DSN: '' });
    await expect(flushSentry()).resolves.toBeUndefined();
  });
});

describe('sentry wrapper — enabled (DSN set)', () => {
  const DSN = 'https://abc@o1.ingest.sentry.io/123';

  test('initSentry initializes the SDK with the dsn + environment', () => {
    const { initSentry } = loadFresh({ SENTRY_DSN: DSN, NODE_ENV: 'production' });
    expect(initSentry()).toEqual({ enabled: true });
    expect(mockSentry.init).toHaveBeenCalledTimes(1);
    const cfg = mockSentry.init.mock.calls[0][0];
    expect(cfg.dsn).toBe(DSN);
    expect(cfg.environment).toBe('production');
  });

  test('captureException forwards the error with extra context', () => {
    const { initSentry, captureException } = loadFresh({ SENTRY_DSN: DSN });
    initSentry();
    const err = new Error('kaboom');
    expect(captureException(err, { path: '/x' })).toBe(true);
    expect(mockSentry.captureException).toHaveBeenCalledWith(err, { extra: { path: '/x' } });
  });

  test('captureException never throws even if the SDK throws', () => {
    const { initSentry, captureException } = loadFresh({ SENTRY_DSN: DSN });
    initSentry();
    mockSentry.captureException.mockImplementationOnce(() => { throw new Error('sdk fail'); });
    expect(captureException(new Error('x'))).toBe(false);
  });

  test('flushSentry calls SDK flush', async () => {
    const { initSentry, flushSentry } = loadFresh({ SENTRY_DSN: DSN });
    initSentry();
    await flushSentry();
    expect(mockSentry.flush).toHaveBeenCalledTimes(1);
  });

  test('initSentry is idempotent (second call does not re-init)', () => {
    const { initSentry } = loadFresh({ SENTRY_DSN: DSN });
    initSentry();
    initSentry();
    expect(mockSentry.init).toHaveBeenCalledTimes(1);
  });
});
