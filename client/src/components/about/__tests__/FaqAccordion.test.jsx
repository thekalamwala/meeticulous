import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import FaqAccordion from "../FaqAccordion";

describe("FaqAccordion", () => {
  const expanded = (el) => el.getAttribute("aria-expanded");

  it("opens one panel on click and toggles closed", () => {
    render(<FaqAccordion />);
    const first = screen.getByRole("button", { name: /who are you/i });
    expect(expanded(first)).toBe("false");
    fireEvent.click(first);
    expect(expanded(first)).toBe("true");
    fireEvent.click(first);
    expect(expanded(first)).toBe("false");
  });

  it("single-open: opening a second closes the first", () => {
    render(<FaqAccordion />);
    const a = screen.getByRole("button", { name: /who are you/i });
    const b = screen.getByRole("button", { name: /where are you based/i });
    fireEvent.click(a);
    fireEvent.click(b);
    expect(expanded(a)).toBe("false");
    expect(expanded(b)).toBe("true");
  });
});
