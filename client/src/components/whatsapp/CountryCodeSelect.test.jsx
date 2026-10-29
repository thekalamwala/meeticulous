import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CountryCodeSelect from './CountryCodeSelect';

describe('CountryCodeSelect', () => {
  it('renders the selected dial code and common options', () => {
    render(<CountryCodeSelect value="+91" onChange={vi.fn()} />);
    const select = screen.getByLabelText(/country code/i);
    expect(select.value).toBe('+91');
    expect(screen.getByRole('option', { name: /\+44/ })).toBeInTheDocument();
  });
});
