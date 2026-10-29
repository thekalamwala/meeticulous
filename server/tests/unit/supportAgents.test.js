// Persona map + intro copy — pure, no DB.

const { personaFor, introMessage, FALLBACK } = require('../../config/supportAgents');

test('maps a known admin email to its persona (case/space-insensitive)', () => {
  expect(personaFor('tithi@bookasloth.in')).toBe('Tithi');
  expect(personaFor('  Tithi@BookASloth.in ')).toBe('Tithi');
});

test('unmapped or empty email falls back to a safe generic name (never leaks the email)', () => {
  expect(personaFor('stranger@example.com')).toBe(FALLBACK);
  expect(personaFor('')).toBe(FALLBACK);
  expect(personaFor(undefined)).toBe(FALLBACK);
  expect(personaFor('stranger@example.com')).not.toContain('@');
});

test('intro greets by first name when known, generically otherwise', () => {
  expect(introMessage('Tithi', 'Rahul')).toMatch(/^Hi Rahul — I'm Tithi from the Book A Sloth support team\./);
  expect(introMessage('Tithi', null)).toMatch(/^Hi — I'm Tithi from the Book A Sloth support team\./);
});

test('founder logs in as bookasloth@gmail.com and appears as Shubham', () => {
  expect(personaFor('bookasloth@gmail.com')).toBe('Shubham');
});

test('a titled persona introduces by role, not "from the support team"', () => {
  const intro = introMessage('Shubham', 'Rahul');
  expect(intro).toBe("Hi Rahul — I'm Shubham, Founder & Engineer at Book A Sloth. "
    + "Give me a moment to read your messages and I'll help you right away.");
  expect(intro).not.toContain('support team');
});

test('the generic fallback never doubles the name ("Support Team from the ... support team")', () => {
  const intro = introMessage(FALLBACK, 'Rahul');
  expect(intro).toBe("Hi Rahul — I'm from the Book A Sloth support team. "
    + "Give me a moment to read your messages and I'll help you right away.");
  expect(intro).not.toContain('Support Team from');
});
