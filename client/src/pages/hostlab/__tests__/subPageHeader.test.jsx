// SubPageHeader is now the ONLY heading in the console: all twelve sections
// render through it, and five of them pass `title` because they have no nav.js
// entry to read a label from. Two things are worth a runnable check.
//
// 1. Both ways in work, and `page` wins when both are given — a section that
//    gains a nav entry later should not have to drop its old `title` prop in
//    the same commit to avoid a silently wrong heading.
// 2. Exactly one <h1> comes out. The bug this replaces was five hand-rolled
//    headers whose classes happened to match; the way that regresses is a
//    section re-adding its own <h1> beside this one.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubPageHeader } from '../labUi';

describe('SubPageHeader', () => {
  it('titles from a nav page entry, and uses its blurb as the subtitle', () => {
    render(<SubPageHeader page={{ label: 'Payouts', blurb: 'Where your money is.' }} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Payouts');
    expect(screen.getByText('Where your money is.')).toBeInTheDocument();
  });

  it('titles from a plain string for a page with no nav entry', () => {
    render(<SubPageHeader title="Today">Wednesday, 18 November</SubPageHeader>);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Today');
    expect(screen.getByText('Wednesday, 18 November')).toBeInTheDocument();
  });

  it('prefers the nav page entry over a title prop when both are given', () => {
    render(<SubPageHeader page={{ label: 'Hours', blurb: 'The bookable week.' }} title="Stale" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hours');
  });

  it('lets children override the nav blurb, for a subtitle computed live', () => {
    render(
      <SubPageHeader page={{ label: 'Bookings', blurb: 'static' }}>
        3 upcoming · ₹8,400 collected
      </SubPageHeader>,
    );
    expect(screen.getByText('3 upcoming · ₹8,400 collected')).toBeInTheDocument();
    expect(screen.queryByText('static')).not.toBeInTheDocument();
  });

  it('renders its action, and still exactly one h1', () => {
    render(<SubPageHeader title="Catalog" action={<button type="button">New</button>} />);
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
