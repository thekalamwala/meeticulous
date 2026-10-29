import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import TestimonialsFlip from "../TestimonialsFlip";
import { testimonials } from "../aboutContent";

describe("TestimonialsFlip", () => {
  it("renders every host name and quote (front + back of each card)", () => {
    render(<TestimonialsFlip />);
    expect(screen.getAllByText(testimonials.items[0].name).length).toBeGreaterThan(0);
    expect(screen.getAllByText(testimonials.items[0].quote).length).toBeGreaterThan(0);
  });

  it("renders the section heading", () => {
    render(<TestimonialsFlip />);
    expect(screen.getByRole("heading", { name: testimonials.heading })).toBeInTheDocument();
  });
});
