import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TipWidget from '../components/community/TipWidget';

const VPA = '8637758344@ybl';
// The chosen amount drives the QR (its `value` uri) and this caption together,
// so the caption is the observable proxy for the pay amount. It's the only
// <strong>₹N</strong> on the card (preset buttons are <button>, not strong).
const strongAmount = (_, el) => el?.tagName === 'STRONG' && /^₹[\d,]+$/.test(el.textContent || '');
const payAmount = () => screen.getByText(strongAmount);

describe('TipWidget', () => {
  it('shows the default preset amount', () => {
    render(<TipWidget vpa={VPA} payeeName="Shubham" note="Tip" />);
    expect(payAmount().textContent).toBe('₹200');
  });

  it('switches amount when a preset is picked', () => {
    render(<TipWidget vpa={VPA} payeeName="Shubham" />);
    fireEvent.click(screen.getByRole('button', { name: '₹500' }));
    expect(payAmount().textContent).toBe('₹500');
  });

  it('uses a custom amount over the preset', () => {
    render(<TipWidget vpa={VPA} payeeName="Shubham" />);
    fireEvent.change(screen.getByLabelText(/custom amount/i), { target: { value: '777' } });
    expect(payAmount().textContent).toBe('₹777');
  });

  it('rejects a custom amount outside ₹51–₹51,000', () => {
    render(<TipWidget vpa={VPA} payeeName="Shubham" />);
    fireEvent.change(screen.getByLabelText(/custom amount/i), { target: { value: '20' } });
    expect(screen.getByRole('alert').textContent).toContain('₹51');
    expect(screen.queryByText(strongAmount)).toBeNull();
  });
});
