const svc = require('../../services/whatsappTemplateService');

test('builds ordered templateParams from variable_map + contact data', () => {
  const tpl = { param_count: 4, variable_map: { 1: 'first_name', 2: 'service_name', 3: 'vendor_name', 4: 'booking_datetime' } };
  const params = svc.buildParams(tpl, { first_name: 'Asha', service_name: 'SEO', vendor_name: 'BAS', booking_datetime: 'Mon 10am' });
  expect(params).toEqual(['Asha', 'SEO', 'BAS', 'Mon 10am']);
});

test('missing fields become empty strings, order preserved', () => {
  const tpl = { param_count: 2, variable_map: { 1: 'first_name', 2: 'city' } };
  expect(svc.buildParams(tpl, { first_name: 'Asha' })).toEqual(['Asha', '']);
});

test('zero params returns empty array', () => {
  expect(svc.buildParams({ param_count: 0, variable_map: {} }, { first_name: 'Asha' })).toEqual([]);
});
