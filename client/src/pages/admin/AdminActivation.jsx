import { useEffect, useState } from 'react';
import { adminGetActivation, adminTestNudges } from '../../services/api';

// Host activation funnel board. Reads /admin/activation (host_activation views).
// North Star: % of new hosts who reach their first payout. The stuck list =
// hosts with a real priced service but no booking yet — the concierge worklist.

const STAGES = [
  { key: 'total', label: 'Signed up' },
  { key: 'onboarded', label: 'Onboarded' },
  { key: 'listed', label: 'Listed (priced)' },
  { key: 'shared', label: 'Shared link' },
  { key: 'booked', label: 'Got a booking' },
  { key: 'paid', label: 'Paid booking' },
  { key: 'payout', label: 'Payout' },
  { key: 'activated', label: 'Activated (2+)' },
];

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

export default function AdminActivation() {
  const [data, setData] = useState(null);
  const [includeInternal, setIncludeInternal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [test, setTest] = useState({ email: 'sndatarkar@gmail.com', phone: '8637758344', name: 'Datarkar' });
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const sendTest = async () => {
    setTesting(true); setTestResult(null);
    try { const r = await adminTestNudges(test); setTestResult(r.data); }
    catch (e) { setTestResult({ error: e?.response?.data?.message || 'Failed' }); }
    finally { setTesting(false); }
  };

  useEffect(() => {
    let live = true;
    setLoading(true);
    adminGetActivation(includeInternal)
      .then((r) => { if (live) { setData(r.data); setErr(null); } })
      .catch((e) => { if (live) setErr(e?.response?.data?.message || 'Failed to load'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [includeInternal]);

  const funnel = data?.funnel;
  const stuck = data?.stuck || [];
  const top = funnel?.total || 0;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-ink">Host Activation</h1>
          <p className="mt-1 text-sm text-neutral-500">
            North Star: new hosts reaching their <strong>first payout</strong>. Not signups.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input type="checkbox" checked={includeInternal} onChange={(e) => setIncludeInternal(e.target.checked)} />
          Include internal/test
        </label>
      </div>

      {loading && <p className="mt-8 text-sm text-neutral-400">Loading…</p>}
      {err && <p className="mt-8 text-sm text-red-600">{err}</p>}
      {data?.pending_migration && (
        <p className="mt-8 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          Funnel views not applied on this DB yet (v3.161/v3.162).
        </p>
      )}

      {funnel && (
        <>
          {/* Funnel bars */}
          <div className="mt-6 rounded-xl border border-black/5 bg-white p-5">
            {STAGES.map((s) => {
              const v = funnel[s.key] ?? 0;
              return (
                <div key={s.key} className="flex items-center gap-3 py-1.5">
                  <div className="w-32 flex-shrink-0 text-right text-xs font-medium text-neutral-500">{s.label}</div>
                  <div className="relative h-6 flex-1 overflow-hidden rounded bg-neutral-100">
                    <div
                      className="h-full rounded bg-primary/80"
                      style={{ width: `${pct(v, top)}%`, minWidth: v ? '2px' : 0 }}
                    />
                  </div>
                  <div className="w-24 flex-shrink-0 text-sm font-semibold text-ink">
                    {v} <span className="text-xs font-normal text-neutral-400">({pct(v, top)}%)</span>
                  </div>
                </div>
              );
            })}
            <div className="mt-3 border-t border-black/5 pt-3 text-sm text-neutral-500">
              Lifetime GMV (paid): <strong className="text-ink">₹{Number(funnel.total_gmv || 0).toLocaleString('en-IN')}</strong>
            </div>
          </div>

          {/* Test send */}
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="font-heading text-sm font-bold text-amber-900">Test send — all 4 nudges to one recipient</h2>
            <p className="mb-3 text-xs text-amber-800">Bypasses the on/off gates; sends only to who you enter. WhatsApp needs the AiSensy templates approved first.</p>
            <div className="flex flex-wrap items-end gap-2">
              <input value={test.email} onChange={(e) => setTest({ ...test, email: e.target.value })} placeholder="email" className="rounded border border-black/10 px-2 py-1 text-sm" />
              <input value={test.phone} onChange={(e) => setTest({ ...test, phone: e.target.value })} placeholder="phone" className="rounded border border-black/10 px-2 py-1 text-sm" />
              <input value={test.name} onChange={(e) => setTest({ ...test, name: e.target.value })} placeholder="name" className="w-28 rounded border border-black/10 px-2 py-1 text-sm" />
              <button onClick={sendTest} disabled={testing} className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{testing ? 'Sending…' : 'Send test'}</button>
            </div>
            {testResult && <pre className="mt-3 overflow-x-auto rounded bg-white p-2 text-xs text-neutral-700">{JSON.stringify(testResult, null, 2)}</pre>}
          </div>

          {/* Stuck worklist */}
          <div className="mt-8">
            <h2 className="font-heading text-lg font-bold text-ink">
              Stuck: priced, no booking yet <span className="text-neutral-400">({stuck.length})</span>
            </h2>
            <p className="mb-3 text-sm text-neutral-500">The concierge call-list. Ask each: what stopped you sharing / getting booked?</p>
            <div className="overflow-x-auto rounded-xl border border-black/5">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-400">
                  <tr>
                    <th className="px-3 py-2">Host</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Stage</th>
                    <th className="px-3 py-2">Svcs</th>
                    <th className="px-3 py-2">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {stuck.map((h) => (
                    <tr key={h.host_id} className="border-t border-black/5">
                      <td className="px-3 py-2">
                        <div className="font-medium text-ink">{h.name || '—'}</div>
                        <div className="text-xs text-neutral-400">{h.email}{h.profession ? ` · ${h.profession}` : ''}</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {h.phone
                          ? <a className="text-primary-cta hover:underline" href={`https://wa.me/${String(h.phone).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">{h.phone}</a>
                          : <span className="text-neutral-300">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${h.stage === '3b_shared' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                          {h.stage === '3b_shared' ? 'shared' : 'listed'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-neutral-600">{h.priced_services}</td>
                      <td className="px-3 py-2 text-neutral-600">{h.days_since_signup}</td>
                    </tr>
                  ))}
                  {stuck.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-400">Nobody stuck here 🎉</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
