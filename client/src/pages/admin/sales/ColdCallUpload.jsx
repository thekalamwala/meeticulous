import { useState } from 'react';
import toast from 'react-hot-toast';
import { Card, Btn } from '../../../components/admin/ui';
import { crmColdCallImport } from '../../../services/api';
import { parseCsv } from '../../../utils/parseCsv';
import { FIELD_OPTIONS, guessFields, mapRows } from './coldCallUtils';

export default function ColdCallUpload({ lists, onClose, onImported }) {
  const [grid, setGrid] = useState(null);
  const [fields, setFields] = useState([]);
  const [target, setTarget] = useState('new');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const onFile = async (file) => {
    if (!file) return;
    const g = parseCsv(await file.text()).filter((r) => r.some((c) => String(c).trim()));
    if (g.length < 2) { toast.error('That file has no rows'); return; }
    setGrid(g);
    setFields(guessFields(g[0]));
    setName(file.name.replace(/\.[^.]+$/, ''));
  };

  const rows = grid ? mapRows(grid, fields) : [];
  const hasPhone = fields.includes('phone');

  const commit = async () => {
    if (!rows.length) return;
    if (target === 'new' && !name.trim()) { toast.error('Name the list'); return; }
    setBusy(true);
    try {
      const { data } = await crmColdCallImport(rows, target === 'new' ? null : target, name.trim());
      toast.success(`Imported: ${data.created} new, ${data.merged} already known, ${data.skipped} skipped`);
      onImported(data.listId);
    } catch (e) { toast.error(e.response?.data?.message || 'Import failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-label="Upload calling list">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[16px] font-bold adm-t1">Upload calling list</div>
          <Btn size="sm" variant="ghost" onClick={onClose}>Close</Btn>
        </div>
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
        {grid && (
          <>
            <div className="text-[13px] adm-t2">Match each column to a field. Rows without a phone number are skipped.</div>
            <div className="grid grid-cols-2 gap-2">
              {grid[0].map((h, i) => (
                <label key={i} className="flex items-center gap-2 text-[13px]">
                  <span className="w-32 truncate adm-t2" title={h}>{h}</span>
                  <select className="fb-input text-sm" value={fields[i] || ''} onChange={(e) => setFields((f) => f.map((x, j) => (j === i ? e.target.value || null : x)))}>
                    {FIELD_OPTIONS.map((o) => <option key={o} value={o}>{o || '— ignore —'}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {!hasPhone && <div className="text-[13px] text-red-600">Pick which column is the phone number.</div>}
            <div className="text-[13px] adm-t2">{rows.length} of {grid.length - 1} rows ready.</div>
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="adm-t3">Into:</span>
              <select className="fb-input text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="new">New list…</option>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              {target === 'new' && <input className="fb-input text-sm w-64" value={name} onChange={(e) => setName(e.target.value)} placeholder="List name" />}
            </div>
            <div className="flex justify-end"><Btn onClick={commit} disabled={busy || !rows.length}>{busy ? 'Importing…' : `Import ${rows.length} rows`}</Btn></div>
          </>
        )}
      </Card>
    </div>
  );
}
