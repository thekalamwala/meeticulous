import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import About from "../About";
import * as content from "../../components/about/aboutContent";

describe("About page", () => {
  it("renders the story sections in order with hero CTAs and FAQ", () => {
    render(<About />, { wrapper: MemoryRouter });
    expect(screen.getAllByRole("link", { name: /let's get started/i }).length).toBeGreaterThan(0);
    const h2s = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    const order = [
      content.problem.heading,
      content.audiences.heading,
      content.difference.heading,
      content.faq.heading,
      content.finalCta.heading,
    ].map((h) => h2s.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("ships no unfinished placeholder copy or unqualified 0% commission claims", () => {
    const { container } = render(<About />, { wrapper: MemoryRouter });
    const text = container.textContent;
    expect(text).not.toMatch(/\[(placeholder|swap|tbd)/i);
    expect(text).not.toMatch(/0% commission\.?\s*(ever|you keep it all)/i);
  });
});
