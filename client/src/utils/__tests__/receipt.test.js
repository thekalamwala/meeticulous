import { describe, it, expect } from "vitest";
import { buildReceiptHTML } from "../receipt";

const paid = {
  receiptId: "#ABC12345",
  whenText: "Mon, 23 Jun 2026, 3:00 PM IST",
  serviceTitle: "Strategy Call",
  hostName: "Asha",
  guestName: "Riya",
  guestEmail: "riya@example.com",
  status: "confirmed",
  paymentStatus: "paid",
  paymentId: "pay_123",
  price: 1000,
  platformFee: 10,
  platformFeeGst: 1.8,
  total: 1011.8,
};

describe("buildReceiptHTML", () => {
  it("renders a payment receipt with the full fee + GST breakdown for paid bookings", () => {
    const html = buildReceiptHTML(paid);
    expect(html).toContain("Payment Receipt");
    expect(html).toContain("Strategy Call");
    expect(html).toContain("Asha");
    expect(html).toContain("#ABC12345");
    expect(html).toContain("Platform fee");
    expect(html).toContain("GST");
    expect(html).toContain("₹1,011.8"); // customer_total, en-IN formatted
    expect(html).toContain("₹1,000"); // service price line
    expect(html).toContain("pay_123");
  });

  it("includes the guest name and email when provided", () => {
    const html = buildReceiptHTML(paid);
    expect(html).toContain("Riya");
    expect(html).toContain("riya@example.com");
  });

  it("shows a single Unpaid amount with no GST breakdown for unpaid bookings", () => {
    const html = buildReceiptHTML({ ...paid, paymentStatus: "unpaid", paymentId: undefined });
    expect(html).toContain("Unpaid");
    expect(html).not.toContain("Payment Receipt");
    expect(html).not.toContain("Platform fee");
    expect(html).not.toContain("GST");
  });

  it("shows Free for zero-price bookings", () => {
    const html = buildReceiptHTML({ ...paid, price: 0, total: 0, platformFee: 0, platformFeeGst: 0 });
    expect(html).toContain("Free");
    expect(html).not.toContain("Platform fee");
  });

  it("escapes HTML in user-supplied fields to avoid broken markup", () => {
    const html = buildReceiptHTML({ ...paid, serviceTitle: "A <b>bold</b> & risky title" });
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(html).toContain("&amp;");
  });

  // ---- premium redesign: new optional fields ---------------------------

  it("renders the extended fields (id, category, business, payment) when provided", () => {
    const html = buildReceiptHTML({
      ...paid,
      bookingId: "BK-7788",
      category: "consulting",
      businessName: "Asha Advisory",
      customerPhone: "+91 90000 00000",
      venue: "https://meet.example.com/xyz",
      duration: 30,
      timezone: "Asia/Kolkata (IST)",
      notes: "Bring the deck",
      paymentMethod: "UPI",
      gateway: "Razorpay",
      gatewayRef: "ref_999",
      invoiceNumber: "INV-2026-014",
      gstin: "29ABCDE1234F1Z5",
      website: "asha.example.com",
    });
    expect(html).toContain("BK-7788");
    expect(html).toContain("Consulting"); // title-cased category
    expect(html).toContain("Asha Advisory");
    expect(html).toContain("+91 90000 00000");
    expect(html).toContain("meet.example.com/xyz");
    expect(html).toContain("30 min");
    expect(html).toContain("Razorpay");
    expect(html).toContain("ref_999");
    expect(html).toContain("INV-2026-014");
    expect(html).toContain("29ABCDE1234F1Z5");
    expect(html).toContain("Business information");
  });

  it("hides empty fields and their section labels", () => {
    const html = buildReceiptHTML(paid); // no category / business / venue fields
    expect(html).not.toContain("Category");
    expect(html).not.toContain("Business information");
    expect(html).not.toContain("Venue / Meeting link");
    expect(html).not.toContain("GSTIN");
  });

  it("renders discount, coupon, convenience, taxes and refund lines", () => {
    const html = buildReceiptHTML({
      ...paid,
      discount: 100,
      coupon: "WELCOME10",
      convenienceFee: 5,
      taxes: 9,
      refund: 50,
    });
    expect(html).toContain("Discount (WELCOME10)");
    expect(html).toContain("Convenience fee");
    expect(html).toContain("Taxes");
    expect(html).toContain("Refund");
    expect(html).toContain("−₹100"); // minus sign + ₹100
  });

  it("supports gst/transactionId aliases alongside legacy platformFeeGst/paymentId", () => {
    const html = buildReceiptHTML({
      ...paid,
      paymentId: undefined,
      platformFeeGst: 0,
      gst: 18,
      transactionId: "txn_aliased",
    });
    expect(html).toContain("txn_aliased");
    expect(html).toContain("GST");
    expect(html).toContain("₹18");
  });

  it("emits accessible, semantic document scaffolding", () => {
    const html = buildReceiptHTML(paid);
    expect(html).toContain('lang="en"');
    expect(html).toContain("<main");
    expect(html).toContain("Grand total");
    expect(html).toContain("Powered by Timewheel Internet Pvt. Ltd.");
  });
});
