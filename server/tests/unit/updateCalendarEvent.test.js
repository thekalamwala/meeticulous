const mockPatch = jest.fn().mockResolvedValue({ data: { id: 'evt1', hangoutLink: 'https://meet/x', htmlLink: 'h' } });
jest.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: function () { this.setCredentials = () => {}; } },
    calendar: () => ({ events: { patch: mockPatch } }),
  },
}));
const { updateCalendarEvent } = require('../../config/google');

beforeEach(() => jest.clearAllMocks());

test('patches start/end with sendUpdates all, keeps meet link', async () => {
  const out = await updateCalendarEvent('a', 'r', 'evt1', {
    startTime: '2099-01-01T05:00:00.000Z', endTime: '2099-01-01T05:30:00.000Z', timezone: 'Asia/Kolkata',
  });
  expect(mockPatch).toHaveBeenCalledWith(expect.objectContaining({
    calendarId: 'primary', eventId: 'evt1', sendUpdates: 'all',
  }));
  expect(out.meetLink).toBe('https://meet/x');
});
