// client/src/components/admin/ui/Badge.jsx
const Badge = ({ tone = 'neutral', title, children }) => (
  <span title={title} className={`adm-badge adm-badge-${tone}`}>{children}</span>
);
export default Badge;
