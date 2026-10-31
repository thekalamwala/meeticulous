import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ConsentBanner, { openConsentSettings } from "../../components/common/ConsentBanner";
import CookieButton from "../../components/common/CookieButton";
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

  it("full variant (default) renders the cookie illustration, headline and 3 actions", () => {
    const { container } = render(<ConsentBanner />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("We use cookies")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Agree" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Disagree" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe("/privacy");
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

  it("re-opens after a decision when openConsentSettings() fires (cookie button)", () => {
    decided = true;
    render(<ConsentBanner />);
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => openConsentSettings());
    expect(screen.getByRole("dialog", { name: /cookie and analytics consent/i })).toBeTruthy();
  });
});

describe("CookieButton", () => {
  it("shows a 'Cookie settings' circle on the home page that re-opens the banner", () => {
    decided = true;
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ConsentBanner />
        <CookieButton />
      </MemoryRouter>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cookie settings" }));
    expect(screen.getByRole("dialog", { name: /cookie and analytics consent/i })).toBeTruthy();
  });

  it("is not shown on pages outside home / privacy / terms / help", () => {
    render(
      <MemoryRouter initialEntries={["/pricing"]}>
        <CookieButton />
      </MemoryRouter>
    );
    expect(screen.queryByRole("button", { name: "Cookie settings" })).toBeNull();
  });
});
