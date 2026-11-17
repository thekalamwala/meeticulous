import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import OperatorCredit from '../../components/common/OperatorCredit';

const COLUMNS = [
  { title: 'Product', links: [['Features', '#integrations'], ['Pricing', '/pricing'], ['Integrations', '#integrations'], ["What's New", '/changelog']] },
  { title: 'For Professionals', links: [['Coaches & Mentors', '/for/coaches'], ['Consultants', '/for/business-consultant'], ['Doctors', '/for/doctors'], ['Salons', '/for/salon'], ['More professions', '/solutions']] },
  { title: 'Resources', links: [['Blog', '/blog'], ['Help Centre', '/help'], ['FAQs', '#faq'], ['How It Works', '/how-it-works']] },
  { title: 'Company', links: [['About', '/about'], ['Contact', '/contact'], ['Privacy', '/privacy'], ['Terms', '/terms']] },
];

export default function ForPageFooter({ madeFor, label }) {
  return (
    <footer className="border-t border-black/5 bg-white px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <div className="font-heading text-lg font-extrabold" style={{ color: 'var(--v2-ink)' }}>Meeticulous</div>
            <p className="mt-2 max-w-xs text-sm text-slate-500">The simpler way to manage bookings for {label.toLowerCase()}.</p>
            <Link to="/become-a-host" className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white hover:text-white hover:no-underline" style={{ background: 'var(--v2-accent-cta)' }}>
              Create Your Page — Free <ArrowRight size={15} />
            </Link>
          </div>
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-600">{column.title}</div>
              <ul className="mt-4 space-y-2.5">
                {column.links.map(([label, to]) => (
                  <li key={label}>
                    {to.startsWith('#')
                      ? <a href={to} className="text-sm text-slate-600 hover:text-[color:var(--v2-accent-ink)] hover:no-underline">{label}</a>
                      : <Link to={to} className="text-sm text-slate-600 hover:text-[color:var(--v2-accent-ink)] hover:no-underline">{label}</Link>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-black/5 pt-6 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} Meeticulous. <OperatorCredit /></p>
          <p className="text-xs text-slate-500">Made for {madeFor}</p>
        </div>
      </div>
    </footer>
  );
}
