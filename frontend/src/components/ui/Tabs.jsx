export default function Tabs({ tabs, active, onChange, className = '' }) {
  return (
    <div
      role="tablist"
      aria-label="Sections"
      className={`flex gap-1 overflow-x-auto border-b border-line ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={`focus-ring -mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
              isActive
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-500 hover:border-line-strong hover:text-ink-700'
            }`}
          >
            {tab.icon && <tab.icon size={15} aria-hidden="true" />}
            {tab.label}
            {tab.count != null && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'bg-ink-400/10 text-ink-500'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
