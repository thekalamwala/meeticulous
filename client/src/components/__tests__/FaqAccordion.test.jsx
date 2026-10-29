import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import FaqAccordion from '../FaqAccordion';

const faqs = [
  { q: 'How do I book?', a: 'Pick a time and pay online.' },
  { q: 'Is payment secure?', a: 'Yes, processed securely.' },
];

describe('FaqAccordion', () => {
  test('renders every answer in the DOM even when collapsed (AEO invariant)', () => {
    render(<FaqAccordion faqs={faqs} />);
    // Only the first is open by default, but BOTH answers must be present in the DOM.
    expect(screen.getByText('Pick a time and pay online.')).toBeInTheDocument();
    expect(screen.getByText('Yes, processed securely.')).toBeInTheDocument();
  });

  test('toggles aria-expanded per question', () => {
    render(<FaqAccordion faqs={faqs} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');   // defaultOpen=0
    expect(buttons[1]).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(buttons[1]);
    expect(buttons[1]).toHaveAttribute('aria-expanded', 'true');
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');
  });

  test('renders nothing when no faqs', () => {
    const { container } = render(<FaqAccordion faqs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
