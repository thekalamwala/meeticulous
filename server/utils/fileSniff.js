/**
 * fileSniff.js — magic-byte type detection for uploads.
 *
 * Client-supplied mimetype and file extension are attacker-controlled and are
 * never trusted; the first bytes decide the type we store. Extracted from
 * kycController so KYC docs and Host 360 admin documents sniff identically.
 *
 * Returns { ext, mime } for an allowed type, or null to reject.
 */
const sniff = (buf, allowPdf) => {
  if (!buf || buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: 'png', mime: 'image/png' };
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  if (allowPdf && buf.toString('ascii', 0, 4) === '%PDF') return { ext: 'pdf', mime: 'application/pdf' };
  return null;
};

module.exports = { sniff };
