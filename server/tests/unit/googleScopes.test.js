'use strict';
// hasCalendarScopes: a host counts as "Google Calendar connected" only when Google
// actually granted the calendar scopes (events+freebusy, or legacy full calendar).

const { hasCalendarScopes } = require('../../config/google');

const EVENTS = 'https://www.googleapis.com/auth/calendar.events';
const FREEBUSY = 'https://www.googleapis.com/auth/calendar.freebusy';
const SETTINGS = 'https://www.googleapis.com/auth/calendar.settings.readonly';
const LEGACY = 'https://www.googleapis.com/auth/calendar';

describe('hasCalendarScopes', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('full scope string (events + freebusy + settings + identity) is true', () => {
    expect(hasCalendarScopes({ scope: `${EVENTS} ${FREEBUSY} ${SETTINGS} openid email profile` })).toBe(true);
  });

  test('events + freebusy only is true (settings.readonly is optional)', () => {
    expect(hasCalendarScopes({ scope: `${EVENTS} ${FREEBUSY}` })).toBe(true);
  });

  test('events only is false', () => {
    expect(hasCalendarScopes({ scope: EVENTS })).toBe(false);
  });

  test('freebusy only is false', () => {
    expect(hasCalendarScopes({ scope: FREEBUSY })).toBe(false);
  });

  test('identity scopes only is false', () => {
    expect(hasCalendarScopes({ scope: 'openid email profile' })).toBe(false);
  });

  test('legacy full calendar scope is true', () => {
    expect(hasCalendarScopes({ scope: `${LEGACY} openid` })).toBe(true);
  });

  test('legacy scope must match as a whole token, not as a prefix of calendar.events', () => {
    expect(hasCalendarScopes({ scope: `${EVENTS} openid` })).toBe(false);
  });

  test('empty object (no scope) is false', () => {
    expect(hasCalendarScopes({})).toBe(false);
  });

  test('undefined tokens is false', () => {
    expect(hasCalendarScopes(undefined)).toBe(false);
  });

  test('warns when scope is missing', () => {
    hasCalendarScopes({});
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});
