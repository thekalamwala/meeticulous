'use strict';
// Unit tests for the self-harm crisis detector.
const { detectSelfHarm, SELF_HARM_PHRASES, CRISIS_MSG } = require('../../services/bot/selfHarm');

describe('detectSelfHarm', () => {
  it('flags clear first-person crisis statements (English)', () => {
    for (const s of [
      'i want to kill myself',
      'i want to die',
      'i feel suicidal',
      'i want to end my life',
      'thinking about self harm',
      'i want to hurt myself',
    ]) {
      expect(detectSelfHarm(s)).toBe(true);
    }
  });

  it('flags romanized Hindi/Marathi crisis phrases', () => {
    expect(detectSelfHarm('mujhe atmahatya karni hai')).toBe(true);
    expect(detectSelfHarm('mala jagaycha nahi')).toBe(true);
  });

  it('does not flag ordinary product questions', () => {
    for (const s of [
      'how do i cancel my booking',
      'my payment failed can you help',
      'can i change my availability for next week',
    ]) {
      expect(detectSelfHarm(s)).toBe(false);
    }
  });

  it('does not flag a threat aimed at someone else', () => {
    // "kill yourself" is abuse toward another, handled by the threat path — not here.
    expect(detectSelfHarm('kill yourself')).toBe(false);
  });

  it('is safe on empty / nullish input', () => {
    expect(detectSelfHarm('')).toBe(false);
    expect(detectSelfHarm(null)).toBe(false);
    expect(detectSelfHarm(undefined)).toBe(false);
  });

  it('crisis message offers real helplines and no penalty language', () => {
    expect(CRISIS_MSG).toMatch(/14416|findahelpline/i);
    expect(CRISIS_MSG).not.toMatch(/timeout|ending this here/i);
    expect(Array.isArray(SELF_HARM_PHRASES)).toBe(true);
    expect(SELF_HARM_PHRASES.length).toBeGreaterThan(0);
  });
});
