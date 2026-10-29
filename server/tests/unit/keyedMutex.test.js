const { runExclusive } = require('../../utils/keyedMutex');

describe('keyedMutex.runExclusive', () => {
  test('serializes same-key sections (no interleave)', async () => {
    const events = [];
    const section = (id) => async () => {
      events.push(`start:${id}`);
      await new Promise((r) => setTimeout(r, 5));
      events.push(`end:${id}`);
      return id;
    };
    const results = await Promise.all([
      runExclusive('k', section('a')),
      runExclusive('k', section('b')),
      runExclusive('k', section('c')),
    ]);
    expect(results).toEqual(['a', 'b', 'c']);
    // Each section fully completes before the next starts.
    expect(events).toEqual([
      'start:a', 'end:a', 'start:b', 'end:b', 'start:c', 'end:c',
    ]);
  });

  test('different keys run concurrently', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const section = () => async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 5));
      concurrent--;
    };
    await Promise.all([
      runExclusive('a', section()),
      runExclusive('b', section()),
      runExclusive('c', section()),
    ]);
    expect(maxConcurrent).toBeGreaterThan(1);
  });

  test('a rejection does not block the next same-key call', async () => {
    const boom = runExclusive('k', async () => { throw new Error('boom'); });
    await expect(boom).rejects.toThrow('boom');
    const ok = await runExclusive('k', async () => 'ok');
    expect(ok).toBe('ok');
  });

  test('the real result/error is returned to the caller', async () => {
    await expect(runExclusive('x', async () => 42)).resolves.toBe(42);
    await expect(runExclusive('x', async () => { throw new Error('e'); })).rejects.toThrow('e');
  });
});
