import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Modal from '../components/booking/Modal';

test('renders children and closes on backdrop + ESC', () => {
  const onClose = vi.fn();
  render(<Modal open title="Hi" onClose={onClose}><p>body</p></Modal>);
  expect(screen.getByText('body')).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('modal-backdrop'));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});

test('renders nothing when closed', () => {
  const { container } = render(<Modal open={false} onClose={() => {}}><p>x</p></Modal>);
  expect(container).toBeEmptyDOMElement();
});
