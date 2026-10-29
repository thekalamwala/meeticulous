'use strict';
/**
 * Guard: nothing may add platform_fee_amount to commission_applied directly.
 *
 * They are stored on DIFFERENT tax bases — the fee EX-GST, the commission
 * GST-INCLUSIVE — so summing them reports the commission's GST as revenue while
 * the same rupees are also reported under taxes, and again when gross is
 * computed as revenue + taxes. Use platformNetFromBooking() instead.
 *
 * Deliberately a NARROW check on one specific wrong expression rather than a
 * general lint rule: no tooling, and no false positives. It found the second
 * instance of this bug (insightsAdminController) that a manual sweep missed.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SKIP_DIRS = new Set(['node_modules', 'tests', '.git', 'migrations', 'coverage']);

function jsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) jsFiles(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

// The two columns combined with + on one line, in either order, ignoring the
// Number()/|| 0 wrapping around each.
const BAD = new RegExp(
  'platform_fee_amount[^\\n;]*\\+[^\\n;]*commission_applied'
  + '|commission_applied[^\\n;]*\\+[^\\n;]*platform_fee_amount',
);

// GMV reconstruction is a DIFFERENT calculation: it rebuilds the transaction
// size the guest saw (host price + fee + commission), not the revenue we kept,
// so the ex-GST split doesn't apply. Those lines always carry vendor_amount,
// which is what distinguishes them.
const IS_GMV = /vendor_amount/;

const isComment = (line) => {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
};

test('no source file sums the platform fee and the commission directly', () => {
  const offenders = [];
  for (const file of jsFiles(ROOT)) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (isComment(line) || IS_GMV.test(line)) return;
      if (BAD.test(line)) offenders.push(`${path.relative(ROOT, file)}:${i + 1}  ${line.trim()}`);
    });
  }
  expect(offenders).toEqual([]);
});
