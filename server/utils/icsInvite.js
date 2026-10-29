'use strict';

/**
 * icsInvite — build an RFC-5545 .ics calendar file for a booking. This is OUR OWN
 * invite (works in Apple/Google/Outlook), independent of the host's Google Calendar
 * event. Pure + dependency-free so it's easy to test.
 */

// ICS UTC timestamp: YYYYMMDDTHHMMSSZ.
function icsStamp(input) {
  const d = new Date(input);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

// Escape text per RFC 5545 (commas, semicolons, backslashes, newlines).
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');

// Fold lines longer than 75 octets (spec) — keeps strict parsers happy.
function fold(line) {
  if (line.length <= 74) return line;
  const parts = [];
  let rest = line;
  parts.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length) { parts.push(' ' + rest.slice(0, 73)); rest = rest.slice(73); }
  return parts.join('\r\n');
}

/**
 * @param {{id, title, start, end, description?, location?, organizer?}} b
 * @returns {string|null} ICS text, or null if start/end are unusable.
 */
function buildIcs(b = {}) {
  const dtStart = icsStamp(b.start);
  const dtEnd = icsStamp(b.end) || (dtStart && icsStamp(new Date(new Date(b.start).getTime() + 30 * 60000)));
  const dtStamp = icsStamp(b.stamp || b.start); // deterministic when caller passes stamp (tests)
  if (!dtStart || !dtEnd) return null;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Book A Sloth//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${esc(b.id || 'booking')}@bookasloth.com`,
    `DTSTAMP:${dtStamp || dtStart}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${esc(b.title || 'Your Book A Sloth booking')}`,
    b.description ? `DESCRIPTION:${esc(b.description)}` : null,
    `LOCATION:${esc(b.location || 'Online')}`,
    b.organizer ? `ORGANIZER;CN=${esc(b.organizer)}:mailto:noreply@bookasloth.com` : null,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.map(fold).join('\r\n');
}

module.exports = { buildIcs, icsStamp };
