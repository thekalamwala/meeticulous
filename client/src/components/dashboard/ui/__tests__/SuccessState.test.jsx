import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SuccessState } from '../SuccessState';

describe('SuccessState', () => {
  it('renders title, message and action', () => {
    render(<SuccessState title="Withdrawal requested" message="₹500 on the way" action={<button>Done</button>} />);
    expect(screen.getByText('Withdrawal requested')).toBeInTheDocument();
    expect(screen.getByText('₹500 on the way')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });
});
