import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TopmateVsMeeticulous from "../compare/TopmateVsMeeticulous";
import { FAQ } from "../../components/lp/lpData";
import { PREMIUM_PLAN } from "../../data/plans";

vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ startVendorGoogleAuth: vi.fn() }) }));
vi.mock("../../hooks/useUtm", () => ({ default: () => ({}) }));
vi.mock("../../hooks/useDocumentMeta", () => ({ default: () => {} }));
vi.mock("../../services/analytics", () => ({
  analytics: { page: vi.fn(), track: vi.fn() },
  EVENTS: { LP_VIEWED: "LP_VIEWED", LEAD_CAPTURED: "LEAD_CAPTURED", LP_CTA_CLICKED: "LP_CTA_CLICKED" },
}));

const renderPage = () => render(<MemoryRouter><TopmateVsMeeticulous /></MemoryRouter>);

describe("TopmateVsMeeticulous (Topmate-style rebuild)", () => {
  it("renders a keyword-led hero with the live plan price", () => {
    renderPage();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toMatch(/Topmate alternative/i);
    expect(document.body.textContent).toContain(`₹${PREMIUM_PLAN.monthly}`);
  });

  it("drops the old false claims and shows every FAQ", () => {
    const { container } = renderPage();
    const text = container.textContent;
    ["Rs. 10 / Day", "40%", "Priority DM", "120 seats", "100% of every booking"].forEach((bad) =>
      expect(text, bad).not.toContain(bad));
    expect(container.querySelectorAll("details")).toHaveLength(FAQ.length);
    expect(text).toMatch(/isn.t affiliated with Topmate/);
  });

  it("uses single-button CTAs to /become-a-host and no email field", () => {
    renderPage();
    expect(screen.queryByPlaceholderText("you@email.com")).toBeNull();
    const ctas = screen.getAllByRole("link", { name: /start my page/i });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
    expect(ctas.every((a) => a.getAttribute("href") === "/become-a-host")).toBe(true);
  });

  it("renders the creators showcase block", () => {
    renderPage();
    expect(screen.getByText(/See what creators build/i)).toBeTruthy();
  });
});
