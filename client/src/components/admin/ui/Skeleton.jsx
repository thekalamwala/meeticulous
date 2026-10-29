// client/src/components/admin/ui/Skeleton.jsx
const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-[var(--adm-hover)] ${className}`} />
);
export default Skeleton;
