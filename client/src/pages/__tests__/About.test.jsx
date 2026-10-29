import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import About from "../About";

describe("About page", () => {
  it("renders the rebuilt About page with hero CTAs and FAQ", () => {
    render(<About />, { wrapper: MemoryRouter });
    expect(screen.getAllByRole("link", { name: /let's get started/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /questions, answered/i })).toBeInTheDocument();
  });
});
