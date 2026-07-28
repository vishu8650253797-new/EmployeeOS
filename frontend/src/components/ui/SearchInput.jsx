import { Search, X } from 'lucide-react';

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
  ...props
}) {
  return (
    <div className={`relative ${className}`}>
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
        aria-hidden="true"
      />
      <input
        type="search"
        role="searchbox"
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="focus-ring h-10 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-8 text-sm text-ink-900 placeholder:text-ink-400 transition-colors hover:border-ink-400 [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="focus-ring absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-ink-400 hover:text-ink-700"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
