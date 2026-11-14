'use strict';

/**
 * bookingEmailExtras — small, dependency-light placeholders shared by the two
 * BOOKING_CONFIRMED send sites (free path in bookingController, paid path in
 * services/bookingConfirmation). Keeps both in sync so the redesigned
 * confirmation email always gets a timezone label and an add-to-calendar link.
 *
 * No calendar infrastructure: calendarUrl is just a Google Calendar "render"
 * deep link built from fields we already have — nothing is created server-side.
 */

const { icsStamp } = require('./icsInvite');

/**
 * Short timezone label for the booked time ("IST", "EST", …). en-IN locale so
 * Asia/Kolkata (the default) reads "IST" rather than "GMT+5:30".
 */
function tzLabel(scheduledAt, tz = 'Asia/Kolkata') {
  try {
    const part = new Intl.DateTimeFormat('en-IN', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(new Date(scheduledAt))
      .find((p) => p.type === 'timeZoneName');
    return (part && part.value) || '';
  } catch (_) {
    return '';
  }
}

/**
 * Google Calendar add-event deep link. Returns '' when start/end are unusable so
 * the template renders no dead link.
 * @param {{title, start, durationMin?, end?, details?, location?}} b
 */
function calendarUrl(b = {}) {
  const start = icsStamp(b.start);
  const end = icsStamp(b.end)
    || (start && icsStamp(new Date(new Date(b.start).getTime() + (b.durationMin || 30) * 60000)));
  if (!start || !end) return '';
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: b.title || 'Your Meeticulous booking',
    dates: `${start}/${end}`,
  });
  if (b.details) q.set('details', b.details);
  if (b.location) q.set('location', b.location);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

module.exports = { tzLabel, calendarUrl };
