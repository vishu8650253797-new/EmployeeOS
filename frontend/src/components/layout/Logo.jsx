import { Link } from 'react-router-dom';

export default function Logo({ collapsed = false, to = '/dashboard' }) {
  return (
    <Link
      to={to}
      aria-label="EmployeeOS home"
      className="focus-ring flex items-center gap-2.5 rounded-lg"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white shadow-card">
        E
      </span>
      {!collapsed && (
        <span className="text-[15px] font-semibold tracking-tight text-ink-900">
          Employee<span className="text-brand-600">OS</span>
        </span>
      )}
    </Link>
  );
}
