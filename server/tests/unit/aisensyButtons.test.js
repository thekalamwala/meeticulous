// Verifies the copy-code button param (Authentication/OTP templates) is sent.
const aisensy = require('../../services/aisensyService');

const mockFetch = (capture) => jest.fn(async (_url, opts) => {
  capture.body = JSON.parse(opts.body);
  return { ok: true, text: async () => '{"success":true}' };
});

afterEach(() => { delete global.fetch; });

test('includes a url button with the code when buttonParams given', async () => {
  const cap = {};
  global.fetch = mockFetch(cap);
  await aisensy.sendCampaign({
    apiKey: 'k', campaignName: 'booking_otp', destination: '918637758344',
    userName: 'BAS', templateParams: ['123456'], buttonParams: ['123456'],
  });
  expect(cap.body.templateParams).toEqual(['123456']);
  expect(cap.body.buttons).toHaveLength(1);
  expect(cap.body.buttons[0].sub_type).toBe('url');
  expect(cap.body.buttons[0].index).toBe(0);
  expect(cap.body.buttons[0].parameters[0].text).toBe('123456');
});

test('omits buttons when no buttonParams (non-OTP templates unaffected)', async () => {
  const cap = {};
  global.fetch = mockFetch(cap);
  await aisensy.sendCampaign({
    apiKey: 'k', campaignName: 'booking_confirmation_user', destination: '918637758344',
    userName: 'BAS', templateParams: ['a', 'b', 'c', 'd'],
  });
  expect(cap.body.buttons).toBeUndefined();
});
