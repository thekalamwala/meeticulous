import Reveal from '../../../components/home/Reveal';
import { Camera, MessageCircle, Phone, Calendar, Wallet, StickyNote, Table2, RefreshCw } from 'lucide-react';

// Each tool a different colour → the point is that they're 8 *different*,
// disconnected things you're juggling.
const TOOLS = [
  { label: 'Instagram DMs', Icon: Camera, color: '#E1306C' },
  { label: 'WhatsApp', Icon: MessageCircle, color: '#25D366' },
  { label: 'Phone calls', Icon: Phone, color: '#269CEF' },
  { label: 'Google Calendar', Icon: Calendar, color: '#EA4335' },
  { label: 'UPI apps', Icon: Wallet, color: '#1DA1F2' },
  { label: 'Notes', Icon: StickyNote, color: '#FFB703' },
  { label: 'Spreadsheets', Icon: Table2, color: '#10b981' },
  { label: 'Manual follow-ups', Icon: RefreshCw, color: '#06b6d4' },
];

export default function S02Problem() {
  return (
    <div>
      <Reveal><h2 className="font-heading text-3xl sm:text-4xl max-w-2xl">Getting booked today means juggling <span className="text-primary">eight different apps</span>.</h2></Reveal>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TOOLS.map((t, i) => (
          <Reveal key={t.label} instant>
            <div className="page-card flex items-center gap-2.5 p-3.5 text-sm font-medium"
              style={{ transform: `rotate(${(i % 2 ? 1 : -1) * 1.5}deg)` }}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${t.color}1a`, color: t.color }}>
                <t.Icon size={17} strokeWidth={2.2} />
              </span>
              <span className="leading-tight">{t.label}</span>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal instant><p className="mt-8 text-muted">Messages get missed. Payments slip. You become your own overworked receptionist.</p></Reveal>
    </div>
  );
}
