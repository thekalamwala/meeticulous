const { encodeCursor, decodeCursor } = require('../../../services/community/cursor');
test('round trip', () => {
  const ts = '2026-11-03T10:00:00.000Z';
  expect(decodeCursor(encodeCursor(ts, '3f2b8c1e-1111-4222-8333-444455556666'))).toEqual({ ts, id: '3f2b8c1e-1111-4222-8333-444455556666' });
});
test('garbage -> null', () => {
  for (const g of ['%%%', '', null, undefined, Buffer.from('nope').toString('base64url'), Buffer.from('notadate|x').toString('base64url'), Buffer.from('2026-11-03T10:00:00Z|').toString('base64url')])
    expect(decodeCursor(g)).toBeNull();
});
const U = '3f2b8c1e-1111-4222-8333-444455556666';
test('injection-ish ids and lenient ts rejected', () => {
  for (const id of ['a,b', 'x)', '(y', 'abc']) expect(decodeCursor(encodeCursor('2026-11-03T10:00:00Z', id))).toBeNull();
  expect(decodeCursor(encodeCursor('Nov 3', U))).toBeNull();
});
test('postgres timestamptz round-trips', () => {
  const ts = '2026-11-03T10:00:00.123456+00:00';
  expect(decodeCursor(encodeCursor(ts, U))).toEqual({ ts, id: U });
});
