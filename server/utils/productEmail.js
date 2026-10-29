// productEmail.js — the secure download-link email for a digital-product purchase.
//
// One sender shared by all three issue points so the link is always delivered
// (and the "a copy has been sent to you" promise on the purchase page is true):
//   - verifyProductPayment   (paid, primary path)
//   - handleWebhook          (paid, reconciliation safety net)
//   - freeDownload           (free)
//
// The email deep-links into the SPA purchase page with the download token in a
// `?dl=` param; the page auto-advances to the download step. The token is the
// capability (single 24h / 3-download grant), so this is a magic-link by design.
const sendEmail = require('./sendEmail');
const { securityLog } = require('./logger');

// Self-contained card wrapper (kept independent of the controllers' helpers so
// this util has no cross-controller import).
const wrap = (body) => `
  <div style="max-width:520px;margin:0 auto;padding:26px;border-radius:24px;background:#ffffff;font-family:'Plus Jakarta Sans','Poppins',sans-serif;color:#111827;box-shadow:0 24px 60px rgba(15,23,42,0.08);">
    ${body}
    <div style="margin-top:24px;padding:18px;border-radius:18px;background:#f8fafc;color:#6b7280;font-size:14px;">Book A Sloth — calm booking for busy hosts.</div>
  </div>`;

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));

// Build the deep link to the purchase page's download step. productId (not slug)
// keeps the link stable regardless of slug routing/renames.
const buildDownloadLink = (username, productId, token) => {
  const base = (process.env.CLIENT_URL || 'https://bookasloth.com').replace(/\/+$/, '');
  return `${base}/${encodeURIComponent(username || '')}/product/${encodeURIComponent(productId)}?dl=${encodeURIComponent(token)}`;
};

// Fire-and-forget: never throws (callers run it in the background and must not
// fail a payment because SMTP hiccuped). Load-test mode is a no-op inside
// sendEmail. Returns true if a send was attempted and succeeded.
const sendProductDownloadEmail = async ({
  to, username, productId, productTitle, hostName, downloadToken, isFree,
}) => {
  if (!to || !downloadToken || !productId) return false;
  const link = buildDownloadLink(username, productId, downloadToken);
  const title = esc(productTitle || 'your digital product');
  const html = wrap(`
    <h2 style="margin:0 0 10px;font-size:20px;font-weight:700;">Your download is ready 🎉</h2>
    <p style="margin:0 0 6px;font-size:15px;color:#374151;"><strong>Product:</strong> ${title}</p>
    ${hostName ? `<p style="margin:0 0 16px;font-size:15px;color:#374151;"><strong>Seller:</strong> ${esc(hostName)}</p>` : ''}
    <p style="margin:0 0 18px;font-size:15px;color:#374151;">${isFree ? 'Thanks for grabbing this freebie.' : 'Thank you for your purchase.'} Tap below to download. For your security the link is valid for <strong>24 hours</strong> and up to <strong>3 downloads</strong>.</p>
    <a href="${link}" style="display:inline-block;background:#FE5100;color:#ffffff;text-decoration:none;font-weight:600;padding:13px 24px;border-radius:10px;font-size:15px;">Download now</a>
    <p style="margin:18px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">If the button doesn't work, paste this link into your browser:<br><span style="word-break:break-all;color:#FE5100;">${link}</span></p>
  `);
  try {
    await sendEmail({ to, subject: `Your download: ${productTitle || 'Digital product'}`, html });
    return true;
  } catch (e) {
    securityLog('PRODUCT_EMAIL_FAILED', { productId, error: e.message });
    return false;
  }
};

module.exports = { sendProductDownloadEmail, buildDownloadLink };
