import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import HeroV2 from "../HeroV2";
import { hero } from "../aboutContent";

const setup = () => render(<HeroV2 />, { wrapper: MemoryRouter });

describe("HeroV2", () => {
  it("renders 'Join the team' (→ careers) and 'More about us' (→ in-page story) CTAs", () => {
    setup();
    expect(screen.getByRole("link", { name: /join the team/i }).getAttribute("href")).toBe("/careers");
    expect(screen.getByRole("link", { name: /more about us/i }).getAttribute("href")).toBe("#our-story");
  });

  it("renders a static H1 that states the value proposition", () => {
    setup();
    // NOTE: this suite does not load @testing-library/jest-dom's text matchers
    // (see src/tests/setup.js) — assert via native textContent.
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toContain(hero.title);
    expect(h1.textContent).toContain(hero.titleAccent);
  });
});
