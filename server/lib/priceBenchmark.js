'use strict';
// Pure price-benchmark math — no DB, no env, unit-testable in isolation.
// Advisory "similar hosts charge ₹X–₹Y", data-grounded (never an LLM guess).
// See docs/specs/ai-price-suggestion.md.

// Below this sample size we return no numbers — the client hides the chip rather
// than show a "median of 2 listings".
const BENCHMARK_MIN_SAMPLE = 5;

// p in [0,1] over a sorted-ascending numeric array (nearest-rank on n-1, so
// p=0 -> min, p=1 -> max). null for an empty list.
const percentile = (sortedAsc, p) => {
  if (!sortedAsc.length) return null;
  return sortedAsc[Math.round(p * (sortedAsc.length - 1))];
};

// Reduce a raw price list to {low, median, high, sample_size} — or nulls when the
// sample is too thin to be honest. Drops non-numeric and sub-₹100 (free/fee-only)
// values before counting. Rounds to whole rupees.
const summarizePrices = (prices) => {
  const nums = (prices || [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 100)
    .sort((a, b) => a - b);
  if (nums.length < BENCHMARK_MIN_SAMPLE) return { low: null, median: null, high: null, sample_size: nums.length };
  return {
    low:    Math.round(percentile(nums, 0.25)),
    median: Math.round(percentile(nums, 0.5)),
    high:   Math.round(percentile(nums, 0.75)),
    sample_size: nums.length,
  };
};

module.exports = { BENCHMARK_MIN_SAMPLE, percentile, summarizePrices };
