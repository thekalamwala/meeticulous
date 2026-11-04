// Server error -> user copy for every community write. Codes without set copy fall back to
// the server's own `message` (the controller keeps those user-safe). 429 has no code.
const RATE = "You're posting a lot — try again in a bit.";
const COPY = {
  LINK_NOT_ALLOWED: 'Links unlock once your account is a week old and has a few posts.',
  BLOCKED_LINK: "That link isn't allowed here — share your Meeticulous page instead.",
  COMMUNITY_BANNED: 'Your community access is paused.',
  NOT_EDITABLE: "This can't be changed any more.",
};

export const errCode = (e) => e?.response?.data?.code || null;
export const isTermsRequired = (e) => errCode(e) === 'COMMUNITY_TERMS_REQUIRED';

export function errorCopy(e, user) {
  if (e?.response?.status === 429) return RATE;
  const code = errCode(e);
  if (code === 'CONTACT_NOT_ALLOWED') {
    return user?.is_host
      ? "Phone numbers and emails aren't allowed — guests book through your page."
      : "Phone numbers and emails aren't allowed — keep the conversation here.";
  }
  return COPY[code] || e?.response?.data?.message || "Couldn't send that. Please try again.";
}

export const fmtCount = (n) => n.toLocaleString('en-US');
