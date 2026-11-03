import { render } from '@testing-library/react';
import LinkifiedText from '../LinkifiedText';

test('links a URL with ugc rel and turns \\n into <br>', () => {
  const { container } = render(<LinkifiedText text={'see https://x.com\nok'} />);
  const links = container.querySelectorAll('a');
  expect(links).toHaveLength(1);
  expect(links[0].getAttribute('href')).toBe('https://x.com');
  expect(links[0].getAttribute('rel')).toBe('ugc nofollow noopener');
  expect(links[0].getAttribute('target')).toBe('_blank');
  expect(container.querySelectorAll('br')).toHaveLength(1);
  expect(container.textContent).toBe('see https://x.comok');
});

test('markup renders as text, never as elements', () => {
  const { container } = render(<LinkifiedText text={'<img src=x onerror=alert(1)>'} />);
  expect(container.querySelector('img')).toBeNull();
  expect(container.textContent).toBe('<img src=x onerror=alert(1)>');
});

test('bare domains link only on the server allowlist TLDs; trailing punctuation stays text', () => {
  const { container } = render(<LinkifiedText text={'Try www.foo.co.uk, or bar.com. Not done.Thanks or 5.30pm'} />);
  const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  expect(hrefs).toEqual(['https://www.foo.co.uk', 'https://bar.com']);
  expect(container.textContent).toBe('Try www.foo.co.uk, or bar.com. Not done.Thanks or 5.30pm');
});

test('a javascript: scheme is never a link', () => {
  const { container } = render(<LinkifiedText text={'javascript:alert(1)'} />);
  expect(container.querySelector('a')).toBeNull();
});
