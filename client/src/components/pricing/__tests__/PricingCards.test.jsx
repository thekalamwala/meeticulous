import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PricingCards from "../PricingCards";

// Control the interim fee-only flag. Default false = full display (incl. Starter).
const mockFeeOnly = vi.fn(() => false);
vi.mock("../../../hooks/useFeeOnly", () => ({ default: () => mockFeeOnly() }));

const setup = () => render(<MemoryRouter><PricingCards /></MemoryRouter>);

describe("PricingCards", () => {
  it("renders exactly the two plans", () => {
    const { container } = setup();
    const text = container.textContent;
    expect(text).toContain("Starter");
    expect(text).toContain("Pro");
    // The retired ladder must not resurface on the page customers actually read.
    for (const dead of ["Host+", "Studio", "Enterprise"]) expect(text).not.toContain(dead);
  });

  it("hides the free plan in fee-only mode but keeps the paid one", () => {
    mockFeeOnly.mockReturnValueOnce(true);
    const { container } = setup();
    expect(container.textContent).toContain("Pro");
    expect(container.textContent).not.toContain("forever");
  });

  it("leads with the yearly price and the under-₹10-a-day line", () => {
    const { container } = setup();
    const text = container.textContent;
    expect(text).toContain("₹1,179");
    expect(text).toContain("₹3.23");
    expect(text).toContain("incl. GST");
    expect(text).toContain("Save 58%");
  });

  it("shows the monthly price when the toggle is switched", () => {
    const { container, getByText } = setup();
    fireEvent.click(getByText("Monthly"));
    expect(container.textContent).toContain("₹235");
  });

  it("both CTAs point at the signup route", () => {
    const { container } = setup();
    const links = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(links).toContain("/become-a-host");
    // Enterprise is no longer a card — it's a single line under the comparison
    // table on /pricing, not a fourth plan here.
    expect(links).not.toContain("/enterprise");
  });

  it("shows both persona titles", () => {
    const { container } = setup();
    expect(container.textContent).toContain("Just starting out");
    expect(container.textContent).toContain("Booked and growing");
  });

  it("states the free plan's commission rather than hiding it", () => {
    const { container } = setup();
    expect(container.textContent).toContain("5% per booking");
  });
});
