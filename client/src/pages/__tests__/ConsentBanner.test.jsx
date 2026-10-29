import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConsentBanner from "../../components/common/ConsentBanner";
import { analytics } from "../../services/analytics";

let decided = false;

vi.mock("../../services/analytics", () => ({
  analytics: {
    hasDecided: () => decided,
    setConsent: vi.fn(),
  },
}));

beforeEach(() => {
  decided = false;
  vi.mocked(analytics.setConsent).mockReset();
});

describe("ConsentBanner", () => {
  it("slim variant renders no cookie image", () => {
    const { container } = render(<ConsentBanner variant="slim" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("button", { name: /agree/i })).toBeTruthy();
  });

  it("full variant (default) renders the cookie image", () => {
    const { container } = render(<ConsentBanner />);
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("slim Agree fires the same consent decision (setConsent true)", () => {
    render(<ConsentBanner variant="slim" />);
    fireEvent.click(screen.getByRole("button", { name: /agree/i }));
    expect(vi.mocked(analytics.setConsent)).toHaveBeenCalledWith(true);
  });

  it("renders nothing once decided", () => {
    decided = true;
    const { container } = render(<ConsentBanner variant="slim" />);
    expect(container.firstChild).toBeNull();
  });
});
