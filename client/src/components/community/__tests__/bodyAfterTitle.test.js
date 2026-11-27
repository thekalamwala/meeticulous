import { bodyAfterTitle } from '../ItemCard';

test('drops a body that opens by repeating its title, plus the joining punctuation', () => {
  expect(bodyAfterTitle("hey there i'm new to this platform", "hey there i'm new to this platform.... Please help"))
    .toBe('Please help');
  expect(bodyAfterTitle('Pricing tips', 'pricing TIPS: charge more')).toBe('charge more');
});

test('leaves the body alone when it does not repeat the title, or is only the title', () => {
  expect(bodyAfterTitle('Pricing', 'How do you price?')).toBe('How do you price?');
  expect(bodyAfterTitle('', 'body')).toBe('body');
  expect(bodyAfterTitle('Same', 'Same')).toBe('Same');
});
