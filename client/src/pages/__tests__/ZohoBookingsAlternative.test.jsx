import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ZohoBookingsAlternative, { FAQ } from "../compare/ZohoBookingsAlternative";
import { COMPETITORS } from "../../data/competitors";
import { PREMIUM_PLAN } from "../../data/plans";

vi.mock("../../hooks/useUtm", () => ({ default: () => ({}) }));
vi.mock("../../services/analytics", () => ({
  analytics: { page: vi.fn(), track: vi.fn() },
  EVENTS: { LP_VIEWED: "LP_VIEWED", LP_CTA_CLICKED: "LP_CTA_CLICKED" },
}));

const Z = COMPETITORS.zoho;
const words = (s) => s.trim().split(/\s+/).length;
const renderPage = () => render(<MemoryRouter><ZohoBookingsAlternative /></MemoryRouter>);

describe("ZohoBookingsAlternative", () => {
  it("has exactly one h1", () => {
    renderPage();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("sends every Start free CTA to /become-a-host", () => {
    renderPage();
    const ctas = screen.getAllByRole("link", { name: /start free/i });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
    expect(ctas.every((a) => a.getAttribute("href") === "/become-a-host")).toBe(true);
  });

  it("shows Zoho's paidFrom and Meeticulous's monthly price in the table", () => {
    renderPage();
    const table = screen.getByRole("table");
    expect(within(table).getByText(Z.paidFrom)).toBeTruthy();
    expect(within(table).getByText(new RegExp(`₹${PREMIUM_PLAN.monthly} / month`))).toBeTruthy();
  });

  it("renders one <details> per FAQ entry, each 40-80 words", () => {
    const { container } = renderPage();
    expect(container.querySelectorAll("#faq details")).toHaveLength(FAQ.length);
    FAQ.forEach((f) => {
      expect(words(f.a)).toBeGreaterThanOrEqual(40);
      expect(words(f.a)).toBeLessThanOrEqual(80);
    });
  });

  it("shows the trademark / not-affiliated line", () => {
    renderPage();
    expect(screen.getByText(/is a trademark of its owner\. Meeticulous isn.t affiliated with Zoho Bookings/)).toBeTruthy();
  });

  it("keeps the short answer and hero sub inside their word budgets", () => {
    const { container } = renderPage();
    const short = words(container.querySelector("#short-answer p").textContent);
    expect(short).toBeLessThanOrEqual(35); // one-line verdict, not a paragraph
    const sub = words(container.querySelector("h1").nextElementSibling.textContent);
    expect(sub).toBeGreaterThanOrEqual(40);
    expect(sub).toBeLessThanOrEqual(60);
    expect(document.title.length).toBeLessThanOrEqual(60);
    const desc = document.head.querySelector('meta[name="description"]').getAttribute("content");
    expect(desc.length).toBeGreaterThanOrEqual(140);
    expect(desc.length).toBeLessThanOrEqual(160);
  });

  it("payment toggle starts on Zoho Bookings and switches lanes", () => {
    renderPage();
    const zoho = screen.getByRole("button", { name: Z.name });
    const bas = screen.getByRole("button", { name: "Meeticulous" });
    expect(zoho.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(bas);
    expect(bas.getAttribute("aria-pressed")).toBe("true");
    expect(zoho.getAttribute("aria-pressed")).toBe("false");
  });
});
