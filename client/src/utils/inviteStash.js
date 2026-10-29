// Invite attribution stash (bas_invite) — first touch wins and lives 30 days, then a
// Google signup stops carrying it. Older stashes without a timestamp stay valid.
const KEY = 'bas_invite';
const AT = 'bas_invite_at';
const TTL = 30 * 24 * 60 * 60 * 1000;

export function readInvite(now = Date.now()) {
  try {
    const v = localStorage.getItem(KEY);
    if (!v) return null;
    const at = Number(localStorage.getItem(AT));
    if (at && now - at > TTL) { localStorage.removeItem(KEY); localStorage.removeItem(AT); return null; }
    return v;
  } catch { return null; }
}

// Returns true when this code became the stash (false: an earlier one is still live).
export function stashInvite(code, now = Date.now()) {
  try {
    if (readInvite(now)) return false;
    localStorage.setItem(KEY, String(code).slice(0, 40));
    localStorage.setItem(AT, String(now));
    return true;
  } catch { return false; }
}

// Cold-call tracked links: ?i=<4-char code> on any page.
export const inviteCodeFromUrl = (search) => {
  const c = new URLSearchParams(search || '').get('i');
  return c && /^[A-Za-z0-9]{4}$/.test(c) ? c.toUpperCase() : null;
};
