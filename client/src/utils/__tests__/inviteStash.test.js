import { test, expect, beforeEach } from 'vitest';
import { readInvite, stashInvite, inviteCodeFromUrl } from '../inviteStash';

beforeEach(() => localStorage.clear());

test('first touch wins and lasts 30 days', () => {
  const t0 = Date.parse('2026-10-06T10:00:00Z');
  expect(stashInvite('CX12', t0)).toBe(true);
  expect(stashInvite('ZZ99', t0 + 1000)).toBe(false);            // earlier code still live
  expect(readInvite(t0 + 29 * 864e5)).toBe('CX12');
  expect(readInvite(t0 + 31 * 864e5)).toBeNull();                  // expired → cleared
  expect(stashInvite('ZZ99', t0 + 31 * 864e5)).toBe(true);
});

test('an older stash without a timestamp stays valid', () => {
  localStorage.setItem('bas_invite', 'youtube');
  expect(readInvite()).toBe('youtube');
});

test('?i= must be a 4-char letter/number code', () => {
  expect(inviteCodeFromUrl('?i=cx12')).toBe('CX12');
  expect(inviteCodeFromUrl('?i=CX1')).toBeNull();
  expect(inviteCodeFromUrl('?i=<x>1')).toBeNull();
  expect(inviteCodeFromUrl('')).toBeNull();
});
