import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import HostQuotes from "../HostQuotes";
import { testimonials, team } from "../aboutContent";

describe("HostQuotes", () => {
  it("renders every host's name and quote visibly (no hover required)", () => {
    render(<HostQuotes />);
    testimonials.items.forEach((t) => {
      expect(screen.getByText(t.name)).toBeInTheDocument();
      expect(screen.getByText((text) => text.includes(t.quote))).toBeInTheDocument();
    });
  });

  it("renders the section heading", () => {
    render(<HostQuotes />);
    expect(screen.getByRole("heading", { name: testimonials.heading })).toBeInTheDocument();
  });

  it("never presents a team member as a customer", () => {
    const staff = new Set(team.members.map((m) => m.name));
    testimonials.items.forEach((t) => expect(staff.has(t.name)).toBe(false));
  });
});
