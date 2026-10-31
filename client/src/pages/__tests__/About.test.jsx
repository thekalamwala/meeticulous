import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import About from "../About";
import * as content from "../../components/about/aboutContent";

describe("About page", () => {
  it("renders the story sections in order with hero CTAs and FAQ", () => {
    render(<About />, { wrapper: MemoryRouter });
    expect(screen.getAllByRole("link", { name: /join the team/i }).length).toBeGreaterThan(0);
    // "More about us" jumps to the story section right under the hero.
    expect(screen.getByRole("link", { name: /more about us/i }).getAttribute("href")).toBe("#our-story");
    expect(document.getElementById("our-story")).not.toBeNull();
    const h2s = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    const order = [
      content.problem.heading,
      content.difference.heading,
      content.faq.heading,
    ].map((h) => h2s.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("has no closing 'Make your time bookable.' CTA (removed at the owner's request)", () => {
    render(<About />, { wrapper: MemoryRouter });
    expect(screen.queryByRole("heading", { name: content.finalCta.heading })).toBeNull();
  });

  it("ships no unfinished placeholder copy or unqualified 0% commission claims", () => {
    const { container } = render(<About />, { wrapper: MemoryRouter });
    const text = container.textContent;
    expect(text).not.toMatch(/\[(placeholder|swap|tbd)/i);
    expect(text).not.toMatch(/0% commission\.?\s*(ever|you keep it all)/i);
  });
});
