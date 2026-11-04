import { useState } from 'react';
import { PageHeader } from '../../components/admin/ui';
import ReportsTab from './community/ReportsTab';
import ContentTab from './community/ContentTab';
import MembersTab from './community/MembersTab';
import SpacesTab from './community/SpacesTab';

const TABS = [
  { key: 'reports', label: 'Reports', Panel: ReportsTab },
  { key: 'content', label: 'Content', Panel: ContentTab },
  { key: 'members', label: 'Members', Panel: MembersTab },
  { key: 'spaces',  label: 'Spaces',  Panel: SpacesTab },
];

// Community moderation (spec 9.1/18). community.view = read-only; community.moderate = actions
// (each tab hides its buttons without it; the server enforces the same permission).
export default function AdminCommunity() {
  const [tab, setTab] = useState('reports');
  const { Panel } = TABS.find((t) => t.key === tab);
  return (
    <div className="max-w-[1100px]">
      <PageHeader title="Community" subtitle="Reports, content, members and spaces"
        actions={(
          <div role="tablist" aria-label="Community sections" className="flex gap-1 adm-card rounded-xl p-1">
            {TABS.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${tab === t.key ? 'bg-[#960D32] text-white' : 'adm-t2 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
        )} />
      <div role="tabpanel"><Panel /></div>
    </div>
  );
}
