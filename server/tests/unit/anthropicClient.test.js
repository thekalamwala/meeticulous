describe('anthropicClient', () => {
  const OLD = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (OLD === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = OLD;
    jest.resetModules();
  });

  test('isConfigured false + getClient null when key absent', () => {
    delete process.env.ANTHROPIC_API_KEY;
    jest.resetModules();
    const c = require('../../services/ai/anthropicClient');
    expect(c.isConfigured()).toBe(false);
    expect(c.getClient()).toBeNull();
  });

  test('exposes model ids', () => {
    const c = require('../../services/ai/anthropicClient');
    expect(c.MODELS.generate).toBe('claude-haiku-4-5-20251001');
    expect(c.MODELS.regenerate).toBe('claude-haiku-4-5-20251001');
  });

  test('isConfigured true when key present', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    jest.resetModules();
    const c = require('../../services/ai/anthropicClient');
    expect(c.isConfigured()).toBe(true);
  });
});
