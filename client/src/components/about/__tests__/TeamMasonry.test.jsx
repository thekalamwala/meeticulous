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
    // Company social accounts aren't live yet: only the Meeticulous link (or a
    // member's own link) renders.
    const live = m.socials.filter((s) => s.type === "meeticulous" || (s.href && s.href !== "#"));
    expect(within(dialog).getAllByRole("link").length).toBe(live.length);
  });

  it("renders one shaped portrait per member with name + position, shapes cycling", () => {
    const { container } = setup();
    const gallery = screen.getByRole("list", { name: /meeticulous team/i });
    // One tile per member, plus the trailing "open seat" join card.
    const all = within(gallery).getAllByRole("listitem");
    expect(all).toHaveLength(team.members.length + 1);
    const tiles = all.slice(0, team.members.length);
    team.members.forEach((m) => {
      expect(within(gallery).getByText(m.name)).toBeInTheDocument();
      expect(within(gallery).getAllByText(m.position).length).toBeGreaterThan(0);
    });
    // Every portrait is clipped to one of the 4 shapes, which repeat in order.
    const clips = tiles.map((t) => t.querySelector('[style*="clip-path"]').style.clipPath);
    expect(clips[0]).toContain("team-shape-0");
    expect(clips[3]).toContain("team-shape-3");
    expect(clips[4]).toContain("team-shape-0");
    expect(container.querySelectorAll("clipPath")).toHaveLength(4);
    // No carousel controls any more.
    expect(screen.queryByRole("region", { name: /meeticulous team/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });

  it("ends the team grid with an 'open seat' Join the team card linking to careers", () => {
    setup();
    const gallery = screen.getByRole("list", { name: /meeticulous team/i });
    const last = within(gallery).getAllByRole("listitem").pop();
    const link = within(last).getByRole("link", { name: /join the team/i });
    expect(link.getAttribute("href")).toBe("/careers");
    expect(within(last).getByText("Your seat is open")).toBeInTheDocument();
    // Only one Join link on the section (the old standalone button is gone).
    expect(screen.getAllByRole("link", { name: /join the team/i })).toHaveLength(1);
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
