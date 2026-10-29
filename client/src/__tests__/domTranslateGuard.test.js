// Locks the translation-crash guard: DOM removeChild / insertBefore must no-op
// on a parent mismatch (what browser/in-app translation causes) instead of
// throwing and unmounting the app — while still behaving normally otherwise.
import { describe, it, expect, beforeAll } from 'vitest';
import installDomTranslateGuard from '../utils/domTranslateGuard';

describe('domTranslateGuard', () => {
  beforeAll(() => installDomTranslateGuard());

  it('removeChild on a node the translator reparented is a no-op, not a throw', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    const child = document.createElement('span');
    a.appendChild(child);
    b.appendChild(child); // simulate translation moving `child` from a → b
    // React still thinks `child` lives under `a` and tries to remove it there.
    expect(() => a.removeChild(child)).not.toThrow();
    expect(child.parentNode).toBe(b); // left where the translator put it
  });

  it('insertBefore with a reference node that moved does not throw', () => {
    const parent = document.createElement('div');
    const ref = document.createElement('span');
    const other = document.createElement('div');
    other.appendChild(ref); // ref is NOT a child of parent
    const node = document.createElement('span');
    let result;
    expect(() => { result = parent.insertBefore(node, ref); }).not.toThrow();
    expect(result).toBe(node);
  });

  it('still removes a real child normally', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);
    expect(parent.removeChild(child)).toBe(child);
    expect(child.parentNode).toBe(null);
  });

  it('still inserts before a real reference node normally', () => {
    const parent = document.createElement('div');
    const ref = document.createElement('span');
    parent.appendChild(ref);
    const node = document.createElement('b');
    parent.insertBefore(node, ref);
    expect(node.parentNode).toBe(parent);
    expect(parent.firstChild).toBe(node); // landed before ref
  });
});
