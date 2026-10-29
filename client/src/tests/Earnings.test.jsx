import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../services/api", () => ({ getHostBookings: vi.fn() }));
import { getHostBookings } from "../services/api";
import Earnings from "../pages/Earnings";

const at = (y, m, d = 15) => new Date(y, m, d, 12, 0, 0).toISOString();

describe("Earnings page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the trend chart KPI cards and the service breakdown", async () => {
    getHostBookings.mockResolvedValue({
      data: [
        {
          payment_status: "paid",
          scheduled_at: at(2026, 0),
          vendor_amount: null,
          services: { price: 1000, title: "Coaching" },
        },
        {
          payment_status: "pending",
          scheduled_at: at(2026, 0),
          vendor_amount: null,
          services: { price: 500, title: "Ignored" },
        },
      ],
    });

    render(<Earnings />);

    // KPI card supplied by EarningsTrendChart
    expect(
      await screen.findByRole("button", { name: /net earnings/i }),
    ).toBeTruthy();
    // existing per-service breakdown remains
    expect(screen.getByText("Revenue by Service")).toBeTruthy();
    expect(screen.getByText("Coaching")).toBeTruthy();
    // unpaid booking is excluded from the breakdown
    expect(screen.queryByText("Ignored")).toBeNull();
  });
});
