'use strict';
const { toCsv, zipFiles } = require('../../services/gst/gstExportService');

describe('gstExportService.toCsv', () => {
  test('RFC-4180 quotes cells with commas, quotes and newlines', () => {
    const csv = toCsv(['A', 'B'], [['plain', 'has,comma'], ['has"quote', 'line\nbreak']]);
    expect(csv.split('\n')[0]).toBe('A,B');
    expect(csv).toContain('"has,comma"');
    expect(csv).toContain('"has""quote"');
    expect(csv).toContain('"line\nbreak"');
  });
  test('nullish cells render empty', () => {
    expect(toCsv(['A', 'B'], [[null, undefined]])).toBe('A,B\n,');
  });
});

describe('gstExportService.zipFiles', () => {
  test('produces a valid ZIP buffer (PK magic header)', async () => {
    const buf = await zipFiles([
      { name: 'a.txt', content: 'hello' },
      { name: 'b.csv', content: 'x,y\n1,2' },
    ]);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.slice(0, 2).toString('latin1')).toBe('PK'); // ZIP local-file-header magic
  });
});
