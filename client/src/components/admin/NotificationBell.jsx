// client/src/components/admin/NotificationBell.jsx
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Ic from './Ic';
import { IC } from './adminNav';
import { adminOpsSummary } from '../../services/api';

const SEV = { danger: 'text-red-500 bg-red-50', warning: 'text-amber-600 bg-amber-50', ok: 'text-gray-400 bg-gray-100' };

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState('idle'); // idle | loading | error
  const ref = useRef(null);

  const load = async () => {
    setState('loading');
    try {
      const { data } = await adminOpsSummary();
      setItems(data?.attention || []);
      setTotal(data?.totalAttention || 0);
      setState('idle');
    } catch { setState('error'); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const shown = items.filter(i => i.count > 0);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} aria-label="Notifications"
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
        <Ic d={IC.bell} size={16} />
        {total > 0 && <span data-testid="bell-dot" className="absolute top-[7px] right-[7px] w-[7px] h-[7px] rounded-full bg-[#960D32] ring-2 ring-white" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 adm-card rounded-xl shadow-xl w-72 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 border-b adm-border">
            <p className="text-[10px] font-bold adm-t3 uppercase tracking-widest">Needs attention</p>
            {total > 0 && <span className="text-[11px] font-semibold text-[#960D32]">{total}</span>}
          </div>
          {state === 'loading' && <p className="px-3 py-5 text-center text-[12px] adm-t3">Loading…</p>}
          {state === 'error' && <p className="px-3 py-5 text-center text-[12px] text-red-400">Couldn't load</p>}
          {state === 'idle' && shown.length === 0 && <p className="px-3 py-6 text-center text-[12px] adm-t3">Nothing needs attention</p>}
          {state === 'idle' && shown.map(i => (
            <Link key={i.key} to={i.to} onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 adm-hoverable transition-colors">
              <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${SEV[i.severity] || SEV.ok}`}>{i.count}</span>
              <span className="flex-1 text-[13px] adm-t2 truncate">{i.label}</span>
              <Ic d={IC.chevR} size={12} className="text-gray-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
