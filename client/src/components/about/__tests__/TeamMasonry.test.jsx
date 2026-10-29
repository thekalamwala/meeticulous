import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import TeamMasonry from "../TeamMasonry";
import { team } from "../aboutContent";

const setup = () => render(<TeamMasonry />, { wrapper: MemoryRouter });

describe("TeamMasonry", () => {
  it("renders a clickable card per member (name + role)", () => {
    setup();
    team.members.forEach((m) => {
      expect(screen.getByRole("button", { name: new RegExp(`${m.name}.*${m.role}`, "i") })).toBeInTheDocument();
    });
  });

  it("opens a modal with bio and social icons, no CTA buttons", () => {
    setup();
    const m = team.members[0];
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`${m.name}.*${m.role}`, "i") }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(m.bio)).toBeInTheDocument();
    expect(within(dialog).getAllByRole("link").length).toBe(m.socials.length);
  });

  it("closes the modal on Escape", () => {
    setup();
    const m = team.members[0];
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`${m.name}.*${m.role}`, "i") }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
