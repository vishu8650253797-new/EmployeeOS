import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

// Composable table primitives with consistent styling.
// Wrap in <TableContainer> for card chrome + horizontal scroll on mobile.

export function TableContainer({ children, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-line bg-surface shadow-card ${className}`}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function Table({ children, className = '' }) {
  return <table className={`w-full min-w-max text-left text-sm ${className}`}>{children}</table>;
}

export function THead({ children }) {
  return <thead className="border-b border-line bg-canvas">{children}</thead>;
}

export function TH({ children, sortable = false, sortDir = null, onSort, className = '' }) {
  const content = (
    <span className="inline-flex items-center gap-1.5">
      {children}
      {sortable &&
        (sortDir === 'asc' ? (
          <ArrowUp size={13} />
        ) : sortDir === 'desc' ? (
          <ArrowDown size={13} />
        ) : (
          <ArrowUpDown size={13} className="text-ink-400" />
        ))}
    </span>
  );

  return (
    <th
      scope="col"
      aria-sort={sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : undefined}
      className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500 ${className}`}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className="focus-ring -mx-1 rounded-md px-1 py-0.5 uppercase tracking-wide transition-colors hover:text-ink-900"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </th>
  );
}

export function TBody({ children }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

export function TR({ children, className = '', ...props }) {
  return (
    <tr className={`transition-colors hover:bg-canvas ${className}`} {...props}>
      {children}
    </tr>
  );
}

export function TD({ children, className = '' }) {
  return <td className={`whitespace-nowrap px-4 py-3 text-ink-700 ${className}`}>{children}</td>;
}
