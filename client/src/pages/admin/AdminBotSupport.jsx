// client/src/pages/admin/AdminBotSupport.jsx
// Bolt support console — shell. Each former tab is now its own routed page
// (/admin/support/bolt/:page); the sub-nav pills live in the header's whitespace
// beside the title. Default page = stats.
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/admin/ui';
import StatsPage from './bolt/StatsPage';
import NeedsAnswerPage from './bolt/NeedsAnswerPage';
import FaqsPage from './bolt/FaqsPage';
import AutoSavedPage from './bolt/AutoSavedPage';
import EscalationsPage from './bolt/EscalationsPage';

const PAGES = [
  ['stats', 'Stats', StatsPage],
  ['needs-answer', 'Needs Answer', NeedsAnswerPage],
  ['faqs', 'FAQs', FaqsPage],
  ['auto-saved', 'Auto-saved', AutoSavedPage],
  ['escalations', 'Escalations', EscalationsPage],
];

export default function AdminBotSupport() {
  const navigate = useNavigate();
  const { page } = useParams();
  const active = PAGES.some(([id]) => id === page) ? page : 'stats';
  const Current = (PAGES.find(([id]) => id === active) || PAGES[0])[2];

  const nav = (
    <div className="flex flex-wrap gap-2">
      {PAGES.map(([id, label]) => (
        <button key={id} onClick={() => navigate(`/admin/support/bolt/${id}`)}
          className={'rounded-lg px-3 py-1.5 text-sm font-medium ' + (active === id ? 'bg-[#2E1065] text-white' : 'border adm-border adm-t2')}>
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <PageHeader title="Bolt Support" subtitle="Review what Bolt couldn't answer, and turn gaps into instant FAQ answers." actions={nav} />
      <Current />
    </div>
  );
}
