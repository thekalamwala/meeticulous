import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import WorkGallery from "../WorkGallery";
import { gallery } from "../aboutContent";

describe("WorkGallery (polaroid line)", () => {
  it("renders the heading and one print per gallery photo (photo described by alt text)", () => {
    const { container } = render(<WorkGallery />);
    expect(screen.getByRole("heading", { name: gallery.heading })).toBeInTheDocument();
    expect(container.querySelectorAll(".pl-card")).toHaveLength(gallery.items.length);
    const imgs = [...container.querySelectorAll(".pl-shot img")];
    expect(imgs).toHaveLength(gallery.items.length);
    gallery.items.forEach((g, i) => {
      expect(imgs[i].getAttribute("src")).toContain(g.id);
      expect(imgs[i].getAttribute("alt")).toBe(g.title);
    });
  });

  it("shows no names on the prints and no title / counter / arrows bar", () => {
    const { container } = render(<WorkGallery />);
    expect(screen.getByRole("region", { name: /gallery/i })).toBeInTheDocument();
    container.querySelectorAll(".pl-note").forEach((note) => expect(note.textContent).toBe(""));
    expect(container.querySelector(".pl-bar")).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.queryByText(/\d\d \/ \d\d/)).not.toBeInTheDocument();
  });
});
