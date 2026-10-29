import { render, screen } from '@testing-library/react';
test('minimal', () => {
  render(<div>hello</div>);
  expect(screen.getByText('hello')).toBeTruthy();
});
