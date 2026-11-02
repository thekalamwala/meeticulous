import { describe, it, expect, afterEach, vi } from "vitest";
import { getPricingRegion } from "../pricingRegion";

const setCookie = (v) => {
  document.cookie = `mt_cc=; Max-Age=0; Path=/`;
  if (v) document.cookie = `mt_cc=${v}; Path=/`;
};
const mockTz = (timeZone) =>
  vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({ resolvedOptions: () => ({ timeZone }) });

afterEach(() => {
  setCookie(null);
  vi.restoreAllMocks();
});

describe("getPricingRegion", () => {
  it("uses the edge country cookie first", () => {
    mockTz("Asia/Kolkata");
    setCookie("US");
    expect(getPricingRegion()).toBe("INTL");
    setCookie("IN");
    expect(getPricingRegion()).toBe("IN");
  });

  it("falls back to timezone without a cookie", () => {
    mockTz("Asia/Kolkata");
    expect(getPricingRegion()).toBe("IN");
    vi.restoreAllMocks();
    mockTz("America/New_York");
    expect(getPricingRegion()).toBe("INTL");
  });

  it("defaults to IN when the timezone is unknown", () => {
    mockTz("");
    expect(getPricingRegion()).toBe("IN");
  });
});
