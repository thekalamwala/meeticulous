import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageHeader, Card, StatCard, Btn, Badge, Table, Skeleton } from '../index';
import { MemoryRouter } from 'react-router-dom';
import { IC } from '../../adminNav';

describe('admin ui primitives', () => {
  it('PageHeader renders title, subtitle, actions', () => {
    render(<PageHeader title="Users" subtitle="All platform users" actions={<button>New</button>} />);
    expect(screen.getByRole('heading').textContent).toBe('Users');
    expect(screen.getByText('All platform users')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('Card merges className and renders children', () => {
    const { container } = render(<Card className="p-0">inside</Card>);
    expect(container.firstChild.className).toContain('adm-card');
    expect(container.firstChild.className).toContain('p-0');
    expect(container.firstChild.textContent).toBe('inside');
  });

  it('StatCard renders label/value and links', () => {
    render(<MemoryRouter><StatCard label="GMV" value="₹1.2L" icon="dollar" iconColor="bg-green-500" to="/admin/finance" /></MemoryRouter>);
    expect(screen.getByText('GMV')).toBeInTheDocument();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/admin/finance');
  });

  it('Btn variants + click', () => {
    const onClick = vi.fn();
    render(<Btn variant="danger" icon={IC.trash} onClick={onClick}>Delete</Btn>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-red-600');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('Badge tone class', () => {
    render(<Badge tone="ok">Active</Badge>);
    expect(screen.getByText('Active').className).toContain('adm-badge-ok');
  });

  it('Table renders columns, rows, custom render, empty state', () => {
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'amt', label: 'Amount', render: r => `₹${r.amt}` },
    ];
    const rows = [{ id: 1, name: 'A', amt: 100 }, { id: 2, name: 'B', amt: 250 }];
    const { rerender } = render(<Table columns={columns} rows={rows} rowKey={r => r.id} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('₹250')).toBeInTheDocument();
    rerender(<Table columns={columns} rows={[]} rowKey={r => r.id} empty={<p>Nothing here</p>} />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('Skeleton renders pulse div', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    expect(container.firstChild.className).toContain('animate-pulse');
  });
});
