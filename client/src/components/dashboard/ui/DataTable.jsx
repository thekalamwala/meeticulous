import { cn } from './cn';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

/**
 * One responsive table pattern for the whole dashboard.
 * columns: [{ key, header, render?(row), align?, className?, headerClassName?, hideOnMobile? }]
 * On <md each row collapses into a label:value card (set cards={false} to disable).
 */
export function DataTable({
  columns = [],
  rows = [],
  rowKey = (r, i) => r.id ?? i,
  loading = false,
  skeletonRows = 5,
  empty,
  onRowClick,
  cards = true,
  className = '',
}) {
  const align = { left: 'text-left', right: 'text-right', center: 'text-center' };

  if (loading) {
    return (
      <div className={cn('overflow-hidden rounded-md border border-gray-200 bg-white', className)}>
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-4 py-3.5 last:border-0">
            {columns.map((c, j) => (
              <Skeleton key={c.key || j} className={cn('h-4', j === 0 ? 'w-40' : 'w-20')} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return empty || <EmptyState title="Nothing here yet" description="Items will show up here once added." />;
  }

  return (
    <>
      <div className={cn('hidden overflow-x-auto rounded-md border border-gray-200 bg-white dash-elev-1 md:block', className)}>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500',
                    align[c.align] || 'text-left',
                    c.headerClassName,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && 'cursor-pointer transition-colors hover:bg-gray-50')}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn('px-4 py-3 align-middle text-gray-700', align[c.align] || 'text-left', c.className)}
                  >
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cards && (
        <div className="space-y-3 md:hidden">
          {rows.map((row, i) => (
            <div
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'rounded-md border border-gray-200 bg-white p-4 dash-elev-1',
                onRowClick && 'cursor-pointer active:bg-gray-50',
              )}
            >
              {columns
                .filter((c) => !c.hideOnMobile)
                .map((c) => (
                  <div key={c.key} className="flex items-start justify-between gap-3 py-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{c.header}</span>
                    <span className="text-right text-sm text-gray-800">{c.render ? c.render(row) : row[c.key]}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default DataTable;
