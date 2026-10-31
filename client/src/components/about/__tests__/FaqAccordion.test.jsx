import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import FaqAccordion from "../FaqAccordion";
import { faq } from "../aboutContent";

describe("FaqAccordion", () => {
  const expanded = (el) => el.getAttribute("aria-expanded");
  const q = (i) => screen.getByRole("button", { name: faq.items[i].q });

  it("opens one panel on click and toggles closed", () => {
    render(<FaqAccordion />);
    const first = q(0);
    expect(expanded(first)).toBe("false");
    fireEvent.click(first);
    expect(expanded(first)).toBe("true");
    fireEvent.click(first);
    expect(expanded(first)).toBe("false");
  });

  it("single-open: opening a second closes the first", () => {
    render(<FaqAccordion />);
    const a = q(0);
    const b = q(1);
    fireEvent.click(a);
    fireEvent.click(b);
    expect(expanded(a)).toBe("false");
    expect(expanded(b)).toBe("true");
  });
});
