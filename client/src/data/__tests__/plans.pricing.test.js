import { describe, it, expect } from "vitest";
import {
  ALL_PLANS, FREE_PLAN, PREMIUM_PLAN, PAID_PLANS, FOUNDING,
  PLAN_COLUMNS, PLAN_MATRIX, PREMIUM_PLAN_USD, PREMIUM_YEARLY_PER_MONTH,
  PREMIUM_ANNUAL_SAVING, PREMIUM_ANNUAL_SAVE_PCT, PREMIUM_PER_DAY,
} from "../plans";

describe("plan data", () => {
  it("exposes exactly two public plans", () => {
    expect(ALL_PLANS.map((p) => p.slug)).toEqual(["free", "premium"]);
    expect(PAID_PLANS.map((p) => p.slug)).toEqual(["premium"]);
    expect(PLAN_COLUMNS.map((c) => c.slug)).toEqual(["free", "premium"]);
  });

  it("every plan has the fields the cards render", () => {
    for (const p of ALL_PLANS) {
      expect(p.name).toBeTruthy();
      expect(p.slug).toBeTruthy();
      expect(p.tagline).toBeTruthy();
      expect(p.features.length).toBeGreaterThan(0);
      expect(p.persona.title).toBeTruthy();
    }
  });
});

// Prices shown to a customer are GST-INCLUSIVE — what Razorpay actually charges.
describe("pricing is coherent", () => {
  // v3.230 stores back-solved ex-GST bases; the engine adds GST (round2) on top.
  const charged = (base) => base + Math.round(base * 0.18 * 100) / 100;
  it("matches the DB ex-GST values grossed up by 18%, to the paisa", () => {
    expect(charged(168.64)).toBeCloseTo(PREMIUM_PLAN.monthly, 2); // ₹199.00
    expect(charged(1016.10)).toBeCloseTo(PREMIUM_PLAN.yearly, 2); // ₹1,199.00
    expect(charged(761.86)).toBeLessThanOrEqual(FOUNDING.yearly); // ₹898.99 — never above
  });

  it("a year genuinely costs less than twelve months", () => {
    expect(PREMIUM_PLAN.yearly).toBeLessThan(PREMIUM_PLAN.monthly * 12);
    expect(PREMIUM_ANNUAL_SAVING).toBe(1189);
    expect(PREMIUM_ANNUAL_SAVE_PCT).toBe(50);
    expect(PREMIUM_YEARLY_PER_MONTH).toBe(99); // ₹99.92 floored, never rounded up
  });

  it("the per-day headline is under ₹10 and matches the yearly price", () => {
    const perDay = PREMIUM_PLAN.yearly / 365;
    expect(perDay).toBeLessThan(10);
    expect(PREMIUM_PER_DAY).toBe(`₹${perDay.toFixed(2)}`);
  });

  it("free is actually free", () => {
    expect(FREE_PLAN.monthly).toBe(0);
    expect(FREE_PLAN.yearly).toBe(0);
  });
});

describe("comparison table", () => {
  const rows = PLAN_MATRIX.flatMap((s) => s.rows);

  it("every row has a value for both columns", () => {
    for (const section of PLAN_MATRIX) {
      expect(section.rows.length).toBeGreaterThan(0);
      for (const row of section.rows) {
        expect(row.label).toBeTruthy();
        expect(row).toHaveProperty("free");
        expect(row).toHaveProperty("premium");
      }
    }
  });

  it("is a detailed comparison — at least 20 features", () => {
    expect(rows.length).toBeGreaterThanOrEqual(20);
  });

  // "Don't write smaller numbers — say Limited with a tooltip." Every capped
  // free value is a limited(tip) object, never a bare integer in the cell.
  it("hides small free-plan numbers behind a Limited chip, never bare", () => {
    const limitedCells = rows.filter((r) => r.free && typeof r.free === "object" && r.free.v === "Limited");
    expect(limitedCells.length).toBeGreaterThan(0);
    for (const r of limitedCells) expect(r.free.tip).toBeTruthy(); // the real figure lives in the tooltip
    const freeText = rows.map((r) => r.free).filter((v) => typeof v === "string");
    for (const bare of ["2", "3", "10", "1", "1 (Google)", "10 per 6 months"]) {
      expect(freeText).not.toContain(bare);
    }
  });

  // advanced_reports / data_export etc. live in subscription_plans.features,
  // which NOTHING on the server reads. Listing them = a promise we don't keep.
  it("lists nothing the server does not enforce", () => {
    const labels = rows.map((r) => r.label.toLowerCase());
    for (const banned of ["advanced analytics", "data export", "custom fields", "recurring clients", "multiple availability schedules", "priority feature access", "powered by"]) {
      expect(labels).not.toContain(banned);
    }
  });
});

// The retired ladder must not resurface anywhere a customer can read it.
// NOTE: "Starter" is the LIVE free-plan name now — not a retired tier.
describe("no legacy tiers leak into display copy", () => {
  it("drops Host+ / Studio / Enterprise naming and old prices", () => {
    const blob = JSON.stringify({ ALL_PLANS, PLAN_MATRIX });
    for (const dead of ["Host+", "Studio", "Enterprise", "229", "555", "1,499", "3,650", "235", "1,179", "1,769", "5%"]) {
      expect(blob).not.toContain(dead);
    }
  });
});

// Pricing v2 (docs/pricing-v2-spec.md §1, §6).
describe("pricing v2", () => {
  const rows = PLAN_MATRIX.flatMap((s) => s.rows);
  const row = (label) => rows.find((r) => r.label === label);

  it("commission rows match the rate maps", () => {
    expect(row("Commission on appointments")).toMatchObject({ free: "9%", premium: "0%, no monthly limit" });
    expect(row("Commission on products, courses & memberships")).toMatchObject({ free: "12%", premium: "4%" });
  });

  it("the booking fee row says it is GST-inclusive, floored at ₹300, appointments only", () => {
    const fee = row("Booking fee your guest pays");
    expect(fee.free).toBe(fee.premium);
    expect(fee.free).toMatch(/GST included/);
    expect(fee.free).toMatch(/none under ₹300/);
    expect(fee.free).not.toMatch(/\+ GST/);
  });

  it("founding is a cheaper yearly, then the standard price", () => {
    expect(FOUNDING).toMatchObject({ yearly: 899, nextYearly: PREMIUM_PLAN.yearly });
  });

  it("USD display price is $19 / $99", () => {
    expect(PREMIUM_PLAN_USD).toEqual({ monthly: 19, yearly: 99 });
  });

  it("lists no row the spec bans (calendar integrations, Explore priority until built)", () => {
    const labels = rows.map((r) => r.label.toLowerCase());
    expect(labels.some((l) => l.includes("calendar"))).toBe(false);
    expect(labels.some((l) => l.includes("explore"))).toBe(false);
  });
});
