const { encodeCursor, decodeCursor } = require('../../../services/community/cursor');
test('round trip', () => {
  const ts = '2026-11-03T10:00:00.000Z';
  expect(decodeCursor(encodeCursor(ts, 'abc'))).toEqual({ ts, id: 'abc' });
});
test('garbage -> null', () => {
  for (const g of ['%%%', '', null, undefined, Buffer.from('nope').toString('base64url'), Buffer.from('notadate|x').toString('base64url'), Buffer.from('2026-11-03T10:00:00Z|').toString('base64url')])
    expect(decodeCursor(g)).toBeNull();
});
