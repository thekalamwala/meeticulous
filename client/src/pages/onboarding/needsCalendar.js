// A host needs the onboarding calendar screen only if they have no working
// Google Calendar AND haven't already chosen to skip it.
export const needsCalendar = (user) => !user?.google_calendar_connected && !user?.calendar_skipped;
