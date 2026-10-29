import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LogoMarquee from "../LogoMarquee";
import { logos } from "../aboutContent";

describe("LogoMarquee", () => {
  it("renders the brand track duplicated for a seamless loop", () => {
    render(<LogoMarquee />);
    // Each brand appears twice (track is rendered [...items, ...items]).
    const first = logos.brands[0].name;
    expect(screen.getAllByAltText(first).length).toBe(2);
  });

  it("points every logo at the brands asset folder", () => {
    render(<LogoMarquee />);
    logos.brands.forEach((b) => {
      expect(b.src).toContain("/about/brands/");
    });
  });
});
