import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CountryCodeSelect from './CountryCodeSelect';

describe('CountryCodeSelect', () => {
  it('shows the selected dial code on the trigger', () => {
    render(<CountryCodeSelect value="+91" onChange={vi.fn()} />);
    expect(screen.getByLabelText(/country code/i).textContent).toContain('+91');
  });

  it('opens and picking another code fires onChange with it', () => {
    const onChange = vi.fn();
    render(<CountryCodeSelect value="+91" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/country code/i));
    const uk = screen.getByRole('option', { name: /\+44/ });
    expect(uk).toBeTruthy();
    fireEvent.click(uk);
    expect(onChange).toHaveBeenCalledWith('+44');
  });
});
