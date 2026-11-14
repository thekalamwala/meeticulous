/**
 * tests/CancellationPolicyField.test.jsx
 * The service-form cancellation preset picker + its Pro gating.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import CancellationPolicyField from '../components/services/CancellationPolicyField';

const renderIt = (props) => render(<MemoryRouter><CancellationPolicyField {...props} /></MemoryRouter>);

describe('CancellationPolicyField', () => {
  it('lets a Pro host pick any preset', () => {
    const onChange = vi.fn();
    renderIt({ value: 'standard', onChange, isFree: false });
    fireEvent.click(screen.getByText('Strict'));
    expect(onChange).toHaveBeenCalledWith('strict');
    fireEvent.click(screen.getByText('Flexible'));
    expect(onChange).toHaveBeenCalledWith('flexible');
    expect(screen.queryByText(/upgrade to pro/i)).toBeNull();
  });

  it('locks Pro presets and shows an upgrade nudge for a free host', () => {
    const onChange = vi.fn();
    renderIt({ value: 'standard', onChange, isFree: true });
    // Strict is locked → its button is disabled, so a click does nothing.
    const strictBtn = screen.getByText('Strict').closest('button');
    expect(strictBtn).toBeDisabled();
    fireEvent.click(strictBtn);
    expect(onChange).not.toHaveBeenCalled();
    // Standard is still selectable.
    fireEvent.click(screen.getByText('Standard'));
    expect(onChange).toHaveBeenCalledWith('standard');
    expect(screen.getByRole('link', { name: /upgrade to pro/i })).toHaveAttribute('href', '/dashboard/upgrade?src=cancellation_policy');
  });
});
