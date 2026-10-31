import { render, screen, fireEvent } from "@testing-library/react";
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

  it("highlights one quote at a time; arrows, keys and side-card clicks move it (looping)", () => {
    render(<HostQuotes />);
    const current = () => document.querySelector('figure[aria-current="true"]');
    const items = testimonials.items;
    expect(current().textContent).toContain(items[0].name);

    fireEvent.click(screen.getByRole("button", { name: "Next testimonial" }));
    expect(current().textContent).toContain(items[1].name);

    fireEvent.keyDown(screen.getByRole("region", { name: /what hosts tell us/i }), { key: "ArrowLeft" });
    fireEvent.click(screen.getByRole("button", { name: "Previous testimonial" }));
    expect(current().textContent).toContain(items[items.length - 1].name);

    // Clicking a side card brings it to the centre.
    fireEvent.click(screen.getByText(items[1].name).closest("figure"));
    expect(current().textContent).toContain(items[1].name);
  });

  it("renders the section heading", () => {
    render(<HostQuotes />);
    expect(screen.getByRole("heading", { name: testimonials.heading })).toBeInTheDocument();
  });

  it("never presents a team member as a customer", () => {
    // Pranav Kadoo and Tushar Malvi are on the team and also have testimonials;
    // the quotes are kept on purpose (owner decision, 2026-10-31).
    // Anyone else on the team must not appear as a customer.
    const ALSO_HOSTS = new Set(["Pranav Kadoo", "Tushar Malvi"]);
    const staff = new Set(team.members.map((m) => m.name).filter((n) => !ALSO_HOSTS.has(n)));
    testimonials.items.forEach((t) => expect(staff.has(t.name)).toBe(false));
  });
});
