import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TipWidget from '../components/community/TipWidget';

const VPA = '8637758344@ybl';

describe('TipWidget', () => {
  it('builds a UPI pay link to the payee with the selected amount', () => {
    render(<TipWidget vpa={VPA} payeeName="Shubham" note="Tip" />);
    const link = screen.getByRole('link', { name: /open upi app/i });
    const href = link.getAttribute('href');
    expect(href).toContain('upi://pay?');
    expect(href).toContain('pa=8637758344%40ybl');
    expect(href).toContain('am=200.00'); // default preset
  });

  it('switches amount when a preset is picked', () => {
    render(<TipWidget vpa={VPA} payeeName="Shubham" />);
    fireEvent.click(screen.getByRole('button', { name: '₹500' }));
    expect(screen.getByRole('link', { name: /open upi app/i }).getAttribute('href')).toContain('am=500.00');
  });

  it('uses a custom amount over the preset', () => {
    render(<TipWidget vpa={VPA} payeeName="Shubham" />);
    fireEvent.change(screen.getByLabelText(/custom amount/i), { target: { value: '777' } });
    expect(screen.getByRole('link', { name: /open upi app/i }).getAttribute('href')).toContain('am=777.00');
  });
});
