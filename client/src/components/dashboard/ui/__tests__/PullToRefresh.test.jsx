import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PullToRefresh } from '../PullToRefresh';

describe('PullToRefresh', () => {
  it('renders wrapped content', () => {
    render(<PullToRefresh onRefresh={async () => {}}><div>Feed</div></PullToRefresh>);
    expect(screen.getByText('Feed')).toBeInTheDocument();
  });
});
