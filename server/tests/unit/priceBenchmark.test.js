const { summarizePrices, percentile, BENCHMARK_MIN_SAMPLE } = require('../../lib/priceBenchmark');

describe('percentile', () => {
  test('nearest-rank endpoints and midpoint', () => {
    const a = [100, 200, 300, 400, 500];
    expect(percentile(a, 0)).toBe(100);
    expect(percentile(a, 1)).toBe(500);
    expect(percentile(a, 0.5)).toBe(300);
  });
  test('empty list -> null', () => {
    expect(percentile([], 0.5)).toBeNull();
  });
});

describe('summarizePrices', () => {
  test('returns nulls below the min sample', () => {
    const r = summarizePrices([100, 200, 300, 400]); // 4 < 5
    expect(r.median).toBeNull();
    expect(r.low).toBeNull();
    expect(r.high).toBeNull();
    expect(r.sample_size).toBe(4);
  });

  test('summarizes at/above the min sample', () => {
    const r = summarizePrices([100, 200, 300, 400, 500]);
    expect(r.sample_size).toBe(5);
    expect(r.low).toBe(200);    // p25 -> index round(0.25*4)=1 -> 200
    expect(r.median).toBe(300);
    expect(r.high).toBe(400);   // p75 -> index round(0.75*4)=3 -> 400
  });

  test('drops free / sub-floor prices before counting', () => {
    // three <100 rows are excluded, leaving 4 valid -> below sample floor
    const r = summarizePrices([0, 50, 99, 500, 1000, 1500, 2000]);
    expect(r.sample_size).toBe(4);
    expect(r.median).toBeNull();
  });

  test('ignores non-numeric junk', () => {
    const r = summarizePrices(['500', 600, null, 'abc', 700, 800, 900]);
    expect(r.sample_size).toBe(5); // 500,600,700,800,900
    expect(r.median).toBe(700);
  });

  test('BENCHMARK_MIN_SAMPLE is 5', () => {
    expect(BENCHMARK_MIN_SAMPLE).toBe(5);
  });
});
