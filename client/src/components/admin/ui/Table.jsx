// client/src/components/admin/ui/Table.jsx
// columns: [{ key, label, className?, render?(row) }]
// rows defaults to [] so an unexpected API shape degrades to the empty state
// instead of crashing the page into the route error boundary.
// rowClassName(row) is an optional per-row class hook (e.g. banned-row tint).
const Table = ({ columns, rows = [], rowKey, empty, onRowClick, rowClassName }) => (
  <div className="adm-card rounded-2xl overflow-hidden">
    {rows.length === 0 && empty ? empty : (
      <div className="overflow-x-auto">
        <table className="adm-table w-full text-left">
          <thead>
            <tr>
              {columns.map(c => (
                <th key={c.key} className={`px-4 py-2.5 text-[11px] font-semibold adm-t3 uppercase tracking-wider ${c.className || ''}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`${onRowClick ? 'adm-hoverable cursor-pointer' : ''} ${rowClassName ? rowClassName(row) : ''}`.trim() || undefined}>
                {columns.map(c => (
                  <td key={c.key} className={`px-4 py-3 text-[13px] adm-t2 ${c.className || ''}`}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
export default Table;
