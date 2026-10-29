import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import JoinSplit from "../JoinSplit";
import { join } from "../aboutContent";

describe("JoinSplit", () => {
  it("renders heading and CTA button linking to join.href", () => {
    render(<JoinSplit />, { wrapper: MemoryRouter });
    expect(screen.getByRole("heading", { name: join.heading })).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: join.cta });
    expect(cta.getAttribute("href")).toBe(join.href);
  });
});
