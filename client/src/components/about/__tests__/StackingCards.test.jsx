import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import StackingCards from "../StackingCards";
import { stackCards } from "../aboutContent";

describe("StackingCards", () => {
  // Component renders only the first 3 stacking cards (see StackingCards.jsx slice(0, 3)).
  const shownCards = stackCards.cards.slice(0, 3);

  it("renders the big feature card and the first 3 stacking cards", () => {
    render(<StackingCards />, { wrapper: MemoryRouter });
    expect(screen.getByRole("heading", { name: stackCards.feature.title })).toBeInTheDocument();
    shownCards.forEach((c) => {
      expect(screen.getByRole("heading", { name: c.title })).toBeInTheDocument();
    });
  });

  it("each stacking card exposes its primary + secondary CTA links", () => {
    render(<StackingCards />, { wrapper: MemoryRouter });
    shownCards.forEach((c) => {
      expect(screen.getByRole("link", { name: c.ctaPrimary })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: c.ctaSecondary })).toBeInTheDocument();
    });
  });
});
