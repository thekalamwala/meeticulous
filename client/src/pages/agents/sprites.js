// Pixel data for the four Meeticulous agent mascots (/agents).
// Each body is 32x32. A 16-char row is the LEFT half and is mirrored to 32; a 32-char row is used as-is.
// Palette letters: k outline · b body · h highlight · B shade · c face · p blush · m mouth
//                  x eye shine + e eye top (both hidden when blinking/asleep) · E eye bottom
//                  per-agent extras: g/G/q gills (Pal) · r ears/feet (Rupi) · d forehead dots (Tara)

const INK = '#2B0A14';
export const SHARED = { k: INK, e: INK, E: INK, x: '#FFFFFF', c: '#FBE7D3', p: '#FF9FB0', m: '#C43A59', w: '#FFF6EC', f: 'rgba(43,10,20,.22)' };

export const BODY = {
  pal: { pal: { b: '#3D8BEB', B: '#2A6CC4', h: '#8EC2FF', g: '#FF8FB0', G: '#E0607F', q: '#FFC1D0' }, rows: [
    '................', '............kkkk', '...........khhbb', '..........khbbbb',
    '........kkkbbbbb', '......kkbbbbbbbb', '.....kbhhbbbbbbb', '....kbhbbbbbbbbb',
    '.kkkkbbbbbbbbbbb', 'kqggkbbbbbbbbbbb', 'kgGGkbbbcccccccc', '.kkkkbbccccccccc',
    'kqggkbcccxeccccc', 'kgGGkbccceeccccc', '.kkkkbcccEEccccc', 'kqggkbcppccccckm',
    'kgGGkbccccccccck', '.kkkkbbccccccccc', '....kBbbcccccccc', '.....kBbbccccccc',
    '......kBBbbbbbbb', '.......kkBbbbbbb', '.......kbbbbbccc', '......kbbkbbcccc',
    '.....kbbbkbbcccc', '.....kBbbkbbcccc', '......kkkbbbbccc', '........kBbbbbcc',
    '........kBbbbbbb', '........kBbbbbbk', '.......kbbbbbbbk', '........kkkkkkk.'] },
  rupi: { pal: { b: '#F08A2C', B: '#C9661A', h: '#FFB067', r: '#7A3412' }, rows: [
    '................', '................', '..kkkk..........', '.kwwwwk.........',
    '.kwrrwbk........', '.kwrrbbbkkkkkkkk', '.kwrbbbbbbbbbbbb', '.kbbbbbbbhhbbbbb',
    'kbbbbbbbbbbbbbbb', 'kbbbbbwwbbbbbbbb', 'kbbbbwwwwbbbbbbb', 'kbbbbbbbbbbbcccc',
    'kbcccccxeccccccc', 'kbccccceeccccccc', 'kbcccccEEccccccc', 'kbwppccccccccckm',
    'kbwwccccccccccck', '.kbwwccccccccccc', '..kbbwcccccccccc', '...kkbbbbbbbbbbb',
    '.....kbbbbbbcccc', '....kbkbbbbccccc', '...kbbbkbbcccccc', '...kbbbkbbcccccc',
    '...kBbbkbbbccccc', '....kkkbbbbccccc', '......kbbbbbcccc', '......kBbbbbbbbb',
    '......kBbbbbbbbk', '......krrrrrrrrk', '......krrrrrrrrk', '.......kkkkkkkk.'] },
  ankur: { pal: { b: '#7CC242', B: '#5A9A2A', h: '#B5E67A' }, rows: [
    '................', '....kkkkk.......', '...khhhhbk......', '..khhbbbbbk.....',
    '..khbbbbbbbk....', '..kbbbbbbBbbk...', '...kbbbbbbBbbk..', '....kkbbbbbbBbk.',
    '........kkkkkkbb', '.............kbb', '.........kkkkkbb', '......kkkbbbbbbb',
    '.....kbbbhhbbbbb', '....kbbhhbbbbbbb', '...kbbhbbbbbbbbb', '...kbbbbbbcccccc',
    '..kbbbbbcccccccc', '..kbbbbcccxecccc', '..kbbbcccceecccc', '..kbbbccccEEcccc',
    '..kbbbcppccccckm', '..kbbbccccccccck', '..kBbbbccccccccc', '...kBbbbcccccccc',
    '....kBBbbbbbbbbb', '.....kkbbbbbbccc', '....kbkbbbbccccc', '...kbbbkbbcccccc',
    '...kbbbkbbcccccc', '....kkkbbbbbcccc', '......kBbbbbbbbk', '.......kkkkkkkk.'] },
  tara: { pal: { b: '#A564E0', B: '#7B3FBF', h: '#C99BF2', d: '#FBE7D3', G: '#FFFFFF' }, rows: [
    '..............kk', '.............khh', '.............kbh', '............kbbb',
    '............kbbb', '...........kbbbb', '...........kbbbd', '..........kbbbbd',
    '.kkkkkkkkkbbbddb', 'kbbhhbbbbbbbbddb', '.kbbbbbbbbbbbbbd', '..kbbbbbbbbbbbbd',
    '...kbbbbbbbbbbbb', '....kbbbcccccccc', '....kbckkkkkkccc', '....kbkcccccckkk',
    '....kbkccxecckcc', '....kbkcceecckcc', '....kbkccEEcckcc', '....kbkcccccckcc',
    '....kbckkkkkkccc', '....kbcppccccckc', '....kbbcccccccck', '....kbbbcccccccc',
    '...kbbbbbbbbbbbb', '...kbbbbbbbbbbbb', '..kbbbbbbbbbbbbb', '..kbbbbbbbbbbbbk',
    '.kbbbbbbbbbbbbk.', '.kbbbbbbbbbbbk..', '.kBBBBBBBBBkk...', '..kkkkkkkkk.....'] },
};

// Props and extras. `<name>On` is the frame shown while the agent's tag is open.
export const PART = {
  floor: ['......ffffffffffffffffffffff......', '..ffffffffffffffffffffffffffffff..', '......ffffffffffffffffffffff......'],
  calendar: ['.kk.....kk.', 'kkRkkkkkRkk', 'kPPPPPPPPPk', 'kPPPPPPPPPk', 'kkkkkkkkkkk', 'kwqwqwqwqwk',
    'kwwwwwwwwwk', 'kwqwqwqwqwk', 'kwwwwwwwwwk', 'kwqwqwqwqwk', 'kkkkkkkkkkk'],
  calendarOn: ['.kk.....kk.', 'kkRkkkkkRkk', 'kPPPPPPPPPk', 'kPPPPPPPPPk', 'kkkkkkkkkkk', 'kwwwwwwwRRk',
    'kwwwwwwRRwk', 'kwRRwwRRwwk', 'kwwRRRRwwwk', 'kwwwRRwwwwk', 'kkkkkkkkkkk'],
  coin: ['....kkkk....', '..kkyyyykk..', '.kyHHyyyyyk.', '.kyYYYYYYyk.', 'kyyyyyyYYyyk', 'kyyYYYYYYyyk',
    'kyyyyYYYyyyk', 'kyyyyYYyyyyk', '.kyyyyYYyyk.', '.kyyyyyYYyk.', '..kkyyyykk..', '....kkkk....'],
  tail: ['...kkkkk....', '..kbbbbbk...', '.kbbHbbbbk..', '.kssssssssk.', 'kbbbbbbbbbk.', 'kbbbbbbbbbbk',
    'kssssssssssk', 'kbbbbbbbbbbk', '.kbbbbbbbbbk', '.kssssssssk.', '.kbbbbbbbbk.', '..kbbbbbbk..',
    '..kssssssk..', '...kkkkkk...'],
  z: ['kkkk', '..k.', '.k..', 'kkkk'],
  phone: ['.kkkkkkk.', 'kDDDkDDDk', 'kDLLLLLDk', 'kDLGGGLDk', 'kDGGGGGDk', 'kDGwwwGDk', 'kDGGGGGDk',
    'kDGLLLLDk', 'kDLLLLLDk', 'kDLwwwLDk', 'kDLLLLLDk', 'kDLwwLLDk', 'kDDDwDDDk', '.kkkkkkk.'],
  phoneOn: ['.kkkkkkRR', 'kDDDkDDRR', 'kDLLLLLDk', 'kDLGGGLDk', 'kDGGGGGDk', 'kDGwwwGDk', 'kDGGGGGDk',
    'kDGLLLLDk', 'kDLLLLLDk', 'kDLwwwLDk', 'kDLLLLLDk', 'kDLwwLLDk', 'kDDDwDDDk', '.kkkkkkk.'],
  chart: ['kkkkkkkkkk', 'kwwwwwwwwk', 'kwwwwwwwwk', 'kwwwwwwMwk', 'kwwwwMwMwk', 'kwwMwMwMwk', 'kwwMwMwMwk', 'kqqqqqqqqk', 'kkkkkkkkkk'],
  chartOn: ['kkkkkkkkkk', 'kwwwwwwRRk', 'kwwwwwwMRk', 'kwwwwMwMwk', 'kwwMwMwMwk', 'kwwMwMwMwk', 'kwwMwMwMwk', 'kqqqqqqqqk', 'kkkkkkkkkk'],
};
export const PROP_PAL = { P: '#FF9FB0', q: '#FFC9D3', R: '#960D32', y: '#F6C35A', Y: '#C68A12', H: '#FFE9A8', s: '#8A3B12',
  b: '#F08A2C', D: '#4A2A36', G: '#3DBE6A', L: '#CFF3DA', M: '#7B3FBF' };

// Personalities. speed = sprite pixels per second; reach = how strongly they prefer nearby tiles;
// bob/step = walk bounce height (sprite px) and cadence (ms); blink = ms between blinks (0 = never).
// parts: [part, x, y, zIndex, extraClass] placed on the 32x32 rig.
export const AGENTS = [
  { id: 'pal', name: 'Pal', role: 'Bookings', color: '#3D8BEB', ink: '#2A6CC4', speed: 28, reach: 4, bob: 2, step: 130, blink: 1800,
    prop: 'calendar', parts: [['floor', -1, 29, 0], ['body', 0, 0, 2], ['calendar', 17, 19, 3]] },
  { id: 'rupi', name: 'Rupi', role: 'Payments', color: '#F08A2C', ink: '#B3560F', speed: 18, reach: 2, bob: 1, step: 260, blink: 0, naps: true,
    prop: 'coin', parts: [['floor', -1, 29, 0], ['tail', 21, 14, 1], ['body', 0, 0, 2], ['coin', 2, 19, 3],
      ['z', 24, 4, 4, 'zz'], ['z', 26, 2, 4, 'zz z2'], ['z', 28, 0, 4, 'zz z3']] },
  { id: 'ankur', name: 'Ankur', role: 'Growth', color: '#7CC242', ink: '#4E8A22', speed: 24, reach: 1.5, bob: 1, step: 170, blink: 2600, zigzag: true,
    prop: 'phone', parts: [['floor', -1, 29, 0], ['body', 0, 0, 2], ['phone', 20, 17, 3]] },
  { id: 'tara', name: 'Tara', role: 'Insights', color: '#A564E0', ink: '#7B3FBF', speed: 22, reach: 2, bob: 1, step: 200, blink: 4200, sweeps: true,
    prop: 'chart', parts: [['floor', -1, 29, 0], ['body', 0, 0, 2], ['chart', 19, 21, 3]] },
];

const cache = new Map();
/** Turn a pixel map into a box-shadow list (one 1em shadow per pixel). */
export function shadow(rows, pal, { shut = false, patch = [] } = {}) {
  const key = rows.join('|') + shut + JSON.stringify(patch) + JSON.stringify(pal);
  if (cache.has(key)) return cache.get(key);
  const grid = rows.map((r) => [...(r.length === 16 ? r + [...r].reverse().join('') : r)]);
  for (const [x, y, ch] of patch) grid[y][x] = ch;
  const out = [];
  grid.forEach((row, y) => row.forEach((ch, x) => {
    const c = shut && (ch === 'e' || ch === 'x') ? 'c' : ch;
    const col = pal[c];
    if (col) out.push(`${x + 1}em ${y + 1}em 0 .3px ${col}`); // .3px spread hides seams at fractional zoom
  }));
  cache.set(key, out.join(','));
  return cache.get(key);
}
