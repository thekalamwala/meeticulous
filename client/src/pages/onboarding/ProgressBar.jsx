// `current` is the 1-indexed step number of the screen rendering this bar.
const ProgressBar = ({ current, total }) => {
  const step = Math.min(current, total);
  const percentage = Math.round((step / total) * 100);

  return (
    <div className="sticky top-0 z-10 border-b bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 py-3 sm:py-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-600">
            Step {step} of {total}
          </p>
          <p className="text-sm font-medium text-gray-600">{percentage}%</p>
        </div>
        {/* Segmented progress — one bar per step, filled through the current step */}
        <div className="flex gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full bg-primary transition-all duration-300 ${i < step ? "w-full" : "w-0"}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
