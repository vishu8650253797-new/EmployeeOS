import { useRef, useState } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';

// Generic dropdown menu. `trigger` receives ({ open }) and menu items are
// rendered inside an accessible popover panel.

export default function Dropdown({ trigger, align = 'right', width = 'w-56', children }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useClickOutside(containerRef, () => setOpen(false), open);

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((prev) => !prev);
          }
        }}
      >
        {trigger({ open })}
      </div>
      {open && (
        <div
          role="menu"
          className={`animate-fade-in-up absolute z-50 mt-1.5 ${width} overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-pop ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({ icon: Icon, children, danger = false, className = '', ...props }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`focus-ring flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] transition-colors ${
        danger ? 'text-danger-600 hover:bg-danger-50' : 'text-ink-700 hover:bg-canvas'
      } ${className}`}
      {...props}
    >
      {Icon && <Icon size={15} className={danger ? '' : 'text-ink-400'} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-line" role="separator" />;
}
