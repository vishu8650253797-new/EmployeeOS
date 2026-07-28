import { getInitials } from '../../utils/format';

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
};

// Deterministic soft background per name for visual variety.
const PALETTES = [
  'bg-brand-100 text-brand-800',
  'bg-info-50 text-info-700',
  'bg-success-50 text-success-700',
  'bg-warning-50 text-warning-700',
  'bg-danger-50 text-danger-700',
];

function paletteFor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return PALETTES[hash % PALETTES.length];
}

export default function Avatar({ name = '', src = null, size = 'md', className = '' }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`shrink-0 rounded-full object-cover ${SIZES[size]} ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ${SIZES[size]} ${paletteFor(name)} ${className}`}
    >
      {getInitials(name)}
    </span>
  );
}
