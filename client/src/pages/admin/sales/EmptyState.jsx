import { Btn } from '../../../components/admin/ui';

// Branded empty state — not a sad blank table.
export default function EmptyState({ filtered, onAdd, onImport, onClear }) {
  if (filtered) {
    return (
      <div className="p-12 text-center">
        <p className="adm-t1 font-semibold mb-1">No leads match these filters</p>
        <p className="adm-t3 text-sm mb-4">Try widening the filters or clearing them.</p>
        <Btn variant="outline" size="sm" onClick={onClear}>Clear filters</Btn>
      </div>
    );
  }
  return (
    <div className="p-12 text-center max-w-md mx-auto">
      <p className="adm-t1 font-semibold mb-1">No leads yet</p>
      <p className="adm-t3 text-sm mb-5">Your future customers are out there somewhere. Add one, or import your list to get started.</p>
      <div className="flex justify-center gap-2">
        <Btn size="sm" onClick={onAdd}>+ Add your first lead</Btn>
        <Btn variant="outline" size="sm" onClick={onImport}>Import leads</Btn>
      </div>
    </div>
  );
}
