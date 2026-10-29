import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SimplybookAlternative, { FAQ } from "../compare/SimplybookAlternative";
import { COMPETITORS } from "../../data/competitors";
import { PREMIUM_PLAN } from "../../data/plans";

vi.mock("../../hooks/useUtm", () => ({ default: () => ({}) }));
vi.mock("../../services/analytics", () => ({
  analytics: { page: vi.fn(), track: vi.fn() },
  EVENTS: { LP_VIEWED: "LP_VIEWED", LP_CTA_CLICKED: "LP_CTA_CLICKED" },
}));

const SB = COMPETITORS.simplybook;
const renderPage = () => render(<MemoryRouter><SimplybookAlternative /></MemoryRouter>);

describe("SimplybookAlternative (/compare/simplybook-alternative)", () => {
  it("has exactly one h1", () => {
    renderPage();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("sends every Start free CTA to /be-a-sloth", () => {
    renderPage();
    const ctas = screen.getAllByRole("link", { name: /start free/i });
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    ctas.forEach((a) => expect(a.getAttribute("href")).toBe("/be-a-sloth"));
  });

  it("shows SimplyBook's published paid price and Sloth Active's monthly price in the table", () => {
    renderPage();
    const table = within(screen.getByRole("table"));
    expect(table.getByText(SB.paidFrom)).toBeTruthy();
    expect(table.getByText(new RegExp(`₹${PREMIUM_PLAN.monthly.toLocaleString("en-IN")} / month`))).toBeTruthy();
    // null upi in competitors.js must read "Not listed", never "No".
    expect(table.getByText("Not listed")).toBeTruthy();
  });

  it("renders one FAQ item per FAQ entry (same array feeds JSON-LD)", () => {
    const { container } = renderPage();
    expect(FAQ.length).toBeGreaterThanOrEqual(6);
    expect(container.querySelectorAll("#faq details")).toHaveLength(FAQ.length);
  });

  it("carries the trademark / not-affiliated line and the source link", () => {
    renderPage();
    expect(screen.getByText(/SimplyBook\.me is a trademark of its owner\. Meeticulous isn.t affiliated with SimplyBook\.me/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /SimplyBook\.me pricing page/i }).getAttribute("href")).toBe(SB.source);
  });

  it("booking-cap meter starts at 40 (inside the free cap) and flips past the cap", () => {
    expect(SB.freePlan).toMatch(/\b50 bookings/); // the cap the meter parses
    renderPage();
    const slider = screen.getByLabelText("Bookings per month");
    expect(slider.value).toBe("40");
    expect(screen.queryByText("Paid plan needed")).toBeNull();
    fireEvent.change(slider, { target: { value: "120" } });
    expect(screen.getByText("Paid plan needed")).toBeTruthy();
    expect(screen.getByText(/120 is 70 over the free plan's 50-booking cap/)).toBeTruthy();
  });
});
