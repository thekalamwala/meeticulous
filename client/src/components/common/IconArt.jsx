// IconArt — a soft card holding one lucide icon. Stands in wherever a page used
// to show a mascot illustration, so the layout keeps its shape without art.
export default function IconArt({ icon: Icon, label, className = '', rounded = 'rounded-[10px]', iconClassName = 'h-16 w-16 sm:h-20 sm:w-20' }) {
  return (
    <div
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      className={`flex items-center justify-center border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)] ${rounded} ${className}`}
    >
      <span className="grid place-items-center rounded-full bg-primary-light p-6">
        <Icon className={`${iconClassName} text-primary-cta`} strokeWidth={1.25} aria-hidden="true" />
      </span>
    </div>
  );
}
