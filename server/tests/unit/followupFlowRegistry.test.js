const { FLOWS, getFlow, entitledSteps } = require('../../services/followups/flowRegistry');

test('rebook flow shape', () => {
  const f = getFlow('rebook');
  expect(f.source_type).toBe('booking');
  expect(f.event).toBe('REBOOK_NUDGE_CUSTOMER');
  expect(f.audience).toBe('customer');
  expect(f.steps).toEqual([{ step: 1, offsetDays: 3 }, { step: 2, offsetDays: 21 }]);
});

test('getFlow unknown -> null', () => expect(getFlow('nope')).toBeNull());

test('entitledSteps: -1 all, 2 both, 1 first, 0 none', () => {
  const f = getFlow('rebook');
  expect(entitledSteps(f, -1)).toHaveLength(2);
  expect(entitledSteps(f, 2)).toHaveLength(2);
  expect(entitledSteps(f, 1)).toEqual([{ step: 1, offsetDays: 3 }]);
  expect(entitledSteps(f, 0)).toEqual([]);
});

test('buildPayload snapshots guest/service/host from a booking entity', () => {
  const b = {
    guest_name: 'Ada', guest_email: 'ada@x.com', guest_phone: '+91999', guest_id: 'g1',
    host_id: 'h1', services: { title: 'Tarot' }, profiles: { name: 'Mystic', username: 'mystic' },
  };
  expect(getFlow('rebook').buildPayload(b)).toEqual({
    guest_name: 'Ada', guest_email: 'ada@x.com', guest_phone: '+91999', guest_id: 'g1',
    service_title: 'Tarot', host_name: 'Mystic', host_username: 'mystic', host_id: 'h1',
  });
});
