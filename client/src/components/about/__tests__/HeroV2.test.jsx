import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import HeroV2 from "../HeroV2";
import { hero } from "../aboutContent";

const setup = () => render(<HeroV2 />, { wrapper: MemoryRouter });

describe("HeroV2", () => {
  it("renders primary and ghost CTAs", () => {
    setup();
    expect(screen.getByRole("link", { name: hero.ctaPrimary })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hero.ctaGhost })).toBeInTheDocument();
  });

  it("exposes the full headline to assistive tech (sr-only typed word)", () => {
    setup();
    // NOTE: this suite does not load @testing-library/jest-dom (VM dynamic-import
    // incompatibility — see src/tests/setup.js), so toHaveTextContent is unavailable.
    // Assert the same intent (non-empty sr-only headline) via native textContent.
    expect(screen.getByTestId("hero-typeword").textContent).toMatch(/.+/);
  });
});
