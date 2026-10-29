const { google } = require('googleapis');
const { isLoadTestMode } = require('./loadTestMode');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Scopes needed for Calendar (events + free/busy + timezone) + Meet link
// generation + identity (email/profile). Requested in ONE consent screen —
// vendors never see a separate "connect calendar" step.
//
// Narrowed from the full `calendar` (RESTRICTED) scope to the three "sensitive"
// scopes the code actually uses: create/reschedule/cancel events + Meet
// (calendar.events), availability (calendar.freebusy), and signup timezone
// (calendar.settings.readonly). Dropping full `calendar` removes the
// "permanently delete all your calendars" consent line and keeps Google
// verification on the lighter sensitive-scope path (no CASA audit). Existing
// host refresh tokens granted under full `calendar` keep working (superset).
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.settings.readonly',
  'openid',
  'email',
  'profile',
];

const buildOAuthClient = (accessToken, refreshToken) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return auth;
};

// state: opaque string (signed JWT) carried through the OAuth round-trip so the
// callback can tell vendor-auth flows apart from legacy calendar-connect flows
// and reject forged callbacks (CSRF).
// `prompt` is caller-controlled so returning hosts aren't forced through the full
// consent screen on every login:
//   • undefined (login)  → Google skips consent when the grant already exists → a
//     returning host lands straight through. New users still see consent on their
//     FIRST authorization (Google requires it) and first-grant still returns a
//     refresh token, so nothing is lost.
//   • 'consent' (signup / calendar reconnect / legacy-scope revoke) → forces a
//     fresh refresh token when we actually need to (re)issue one.
const getAuthUrl = (state, { prompt } = {}) => {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    ...(prompt ? { prompt } : {}),
    // Incremental authorization is DELIBERATELY OFF. It carries forward every
    // scope the user ever granted — including the full `auth/calendar` scope we
    // removed from the Cloud Console. Re-attaching a scope the project no longer
    // declares makes Google serve the "This app isn't verified" screen and the
    // Security Center "remove risky access" warning. Google's own remediation
    // guidance is explicit: set include_granted_scopes = false after narrowing
    // scopes. Cost: we lose the "supports incremental authorization" checkbox in
    // OAuth verification. Do NOT flip this back to true.
    include_granted_scopes: false,
    scope: SCOPES,
    ...(state ? { state } : {}),
  });
};

// Revoke a Google refresh/access token at the OAuth endpoint. Used to retire
// grants that still carry the removed full `auth/calendar` scope — nulling our
// stored copy is NOT enough; the grant lives on the user's Google account and
// keeps triggering the Security Center warning until it is revoked.
// Best-effort by design: returns true/false, never throws. A 400 means the
// token is already invalid/revoked, which is the desired end state anyway.
const revokeToken = async (token) => {
  if (!token) return false;
  try {
    const res = await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });
    return res.ok || res.status === 400;
  } catch (err) {
    console.error('google.revokeToken failed (non-fatal):', err.message);
    return false;
  }
};

const getTokensFromCode = async (code) => {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

const createCalendarEvent = async (accessToken, refreshToken, eventDetails) => {
  if (isLoadTestMode()) {
    // Load test: do NOT write to a real calendar. Synthetic, deterministic result.
    return {
      eventId: `loadtest-${eventDetails.title || 'event'}`,
      meetLink: 'https://meet.google.com/loadtest-aaa-bbb-ccc',
      htmlLink: 'https://calendar.google.com/loadtest',
    };
  }
  const auth = buildOAuthClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });

  const event = {
    summary: eventDetails.title,
    description: eventDetails.description || '',
    start: {
      dateTime: eventDetails.startTime,
      timeZone: eventDetails.timezone || 'Asia/Kolkata',
    },
    end: {
      dateTime: eventDetails.endTime,
      timeZone: eventDetails.timezone || 'Asia/Kolkata',
    },
    attendees: eventDetails.attendees || [],
    conferenceData: {
      createRequest: {
        requestId: `bas-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
    conferenceDataVersion: 1,
    sendUpdates: 'all',
  });

  return {
    eventId: response.data.id,
    meetLink: response.data.hangoutLink,
    htmlLink: response.data.htmlLink,
  };
};

// Free/Busy on the vendor's primary calendar between two instants.
// Returns [{ start: ISO, end: ISO }] busy intervals. Throws on API failure —
// callers decide whether a Google outage blocks bookings (it must not).
const getFreeBusy = async (accessToken, refreshToken, timeMinISO, timeMaxISO) => {
  const auth = buildOAuthClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });
  const { data } = await calendar.freebusy.query({
    resource: {
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      items: [{ id: 'primary' }],
    },
  });
  return (data.calendars?.primary?.busy || []).map((b) => ({ start: b.start, end: b.end }));
};

// Vendor's Google Calendar timezone (used to seed availability.timezone at signup).
const getCalendarTimezone = async (accessToken, refreshToken) => {
  const auth = buildOAuthClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });
  const { data } = await calendar.settings.get({ setting: 'timezone' });
  return data?.value || null;
};

// Move an existing event to a new time. Keeps the same Meet link; notifies
// attendees. Used by reschedule.
const updateCalendarEvent = async (accessToken, refreshToken, eventId, { startTime, endTime, timezone }) => {
  const auth = buildOAuthClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });
  const response = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    sendUpdates: 'all',
    resource: {
      start: { dateTime: startTime, timeZone: timezone || 'Asia/Kolkata' },
      end:   { dateTime: endTime,   timeZone: timezone || 'Asia/Kolkata' },
    },
  });
  return {
    eventId: response.data.id,
    meetLink: response.data.hangoutLink,
    htmlLink: response.data.htmlLink,
  };
};

// Cancel/remove an event from the host's calendar; notifies attendees so the
// ghost event disappears from everyone's calendar. Used by cancelBooking (P1-7).
// Best-effort: a 404/410 (already gone) is treated as success.
const deleteCalendarEvent = async (accessToken, refreshToken, eventId) => {
  if (isLoadTestMode()) return { deleted: true };
  const auth = buildOAuthClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    await calendar.events.delete({ calendarId: 'primary', eventId, sendUpdates: 'all' });
  } catch (err) {
    const code = err?.code || err?.response?.status;
    if (code === 404 || code === 410) return { deleted: true }; // already gone
    throw err;
  }
  return { deleted: true };
};

module.exports = {
  oauth2Client,
  getAuthUrl,
  getTokensFromCode,
  revokeToken,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getFreeBusy,
  getCalendarTimezone,
};
