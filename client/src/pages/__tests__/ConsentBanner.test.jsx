import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ConsentBanner, { openConsentSettings } from "../../components/common/ConsentBanner";
import CookieButton from "../../components/common/CookieButton";
import { analytics } from "../../services/analytics";

let decided = false;
let current = null;

vi.mock("../../services/analytics", () => ({
  analytics: {
    hasDecided: () => decided,
    getConsent: () => current,
    setConsent: vi.fn(),
  },
}));

beforeEach(() => {
  decided = false;
  current = null;
  vi.mocked(analytics.setConsent).mockReset();
});

describe("ConsentBanner", () => {
  it("shows Customize / Reject / Accept and a Privacy Policy link", () => {
    render(<ConsentBanner />);
    expect(screen.getByRole("dialog", { name: /cookie settings/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Customize" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe("/privacy");
  });

  it("Accept allows everything; Reject allows nothing", () => {
    const { unmount } = render(<ConsentBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(vi.mocked(analytics.setConsent)).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();
    render(<ConsentBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(vi.mocked(analytics.setConsent)).toHaveBeenLastCalledWith(false);
  });

  it("Customize shows Necessary (always on, locked) + Analytics + Marketing toggles and saves per category", () => {
    render(<ConsentBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Customize" }));
    const necessary = screen.getByLabelText("Necessary cookies, always on");
    expect(necessary.checked).toBe(true);
    expect(necessary.disabled).toBe(true);
    const analyticsToggle = screen.getByLabelText("Analytics cookies");
    const marketingToggle = screen.getByLabelText("Marketing cookies");
    expect(analyticsToggle.checked).toBe(false);
    expect(marketingToggle.checked).toBe(false);
    fireEvent.click(analyticsToggle);
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(vi.mocked(analytics.setConsent)).toHaveBeenCalledWith({ analytics: true, marketing: false });
  });

  it("Back returns to the three buttons without saving", () => {
    render(<ConsentBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Customize" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
    expect(vi.mocked(analytics.setConsent)).not.toHaveBeenCalled();
  });

  it("slim variant is a bottom bar with the same three choices", () => {
    const { container } = render(<ConsentBanner variant="slim" />);
    expect(container.querySelector("img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(vi.mocked(analytics.setConsent)).toHaveBeenCalledWith(true);
  });

  it("renders nothing once decided", () => {
    decided = true;
    const { container } = render(<ConsentBanner variant="slim" />);
    expect(container.firstChild).toBeNull();
  });

  it("re-opens on Customize with the visitor's current choice when openConsentSettings() fires", () => {
    decided = true;
    current = { analytics: true, marketing: false };
    render(<ConsentBanner />);
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => openConsentSettings());
    expect(screen.getByRole("dialog", { name: /cookie settings/i })).toBeTruthy();
    expect(screen.getByLabelText("Analytics cookies").checked).toBe(true);
    expect(screen.getByLabelText("Marketing cookies").checked).toBe(false);
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
    expect(screen.getByRole("dialog", { name: /cookie settings/i })).toBeTruthy();
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
