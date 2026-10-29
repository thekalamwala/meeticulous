import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CalendlyAlternative, { FAQ } from "../compare/CalendlyAlternative";
import { COMPETITORS } from "../../data/competitors";
import { PREMIUM_PLAN } from "../../data/plans";

vi.mock("../../hooks/useUtm", () => ({ default: () => ({}) }));
vi.mock("../../services/analytics", () => ({
  analytics: { page: vi.fn(), track: vi.fn() },
  EVENTS: { LP_VIEWED: "LP_VIEWED", LP_CTA_CLICKED: "LP_CTA_CLICKED" },
}));

const renderPage = () => render(<MemoryRouter><CalendlyAlternative /></MemoryRouter>);
const words = (s) => s.trim().split(/\s+/).length;

describe("CalendlyAlternative (/compare/calendly-alternative)", () => {
  it("has exactly one h1", () => {
    renderPage();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("primary CTAs go to /be-a-sloth", () => {
    renderPage();
    const ctas = screen.getAllByRole("link", { name: /start free/i });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
    expect(ctas.every((a) => a.getAttribute("href") === "/be-a-sloth")).toBe(true);
  });

  it("table shows Calendly's paidFrom and Sloth Active's monthly price", () => {
    renderPage();
    const table = within(screen.getByRole("table"));
    expect(table.getByText(COMPETITORS.calendly.paidFrom)).toBeTruthy();
    expect(table.getByText(new RegExp(`₹${PREMIUM_PLAN.monthly} / month`))).toBeTruthy();
  });

  it("FAQ renders every question, each answer 40-80 words", () => {
    const { container } = renderPage();
    expect(container.querySelectorAll("#faq details")).toHaveLength(FAQ.length);
    FAQ.forEach((f) => expect(words(f.a)).toBeGreaterThanOrEqual(40));
    FAQ.forEach((f) => expect(words(f.a)).toBeLessThanOrEqual(80));
  });

  it("shows the trademark / not-affiliated line", () => {
    renderPage();
    expect(screen.getByText(/Meeticulous isn.t affiliated with Calendly/i)).toBeTruthy();
  });

  it("checkout toggle starts on Standard and switches to the free plan", () => {
    renderPage();
    const std = screen.getByRole("button", { name: "Calendly Standard" });
    const free = screen.getByRole("button", { name: "Calendly free plan" });
    expect(std.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(free);
    expect(free.getAttribute("aria-pressed")).toBe("true");
    expect(std.getAttribute("aria-pressed")).toBe("false");
  });
});
