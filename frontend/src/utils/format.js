export function formatDate(dateStr, options = {}) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function fullName(employee) {
  if (!employee) return '';
  return `${employee.firstName} ${employee.lastName}`;
}

export function formatCurrency(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Payroll amounts are returned by the API as integer minor units (paise),
// not the major-unit numbers formatCurrency() above expects (built for
// whole-rupee fields like Asset.purchasePrice) — using formatCurrency() on a
// minor-units value would render 100x too large, so this is a separate,
// additive function rather than a change to formatCurrency().
export function formatCurrencyFromMinorUnits(amountMinorUnits, currency = 'INR') {
  if (amountMinorUnits == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinorUnits / 100);
}

export function formatDateForInput(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  // Use UTC components — the backend stores/returns dates as UTC midnight, so
  // reading local components here would shift the date by a day in any
  // timezone behind UTC (e.g. the US), silently corrupting it on re-save.
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatAddress(address = {}) {
  const parts = [address.street, address.city, address.state, address.country].filter(Boolean);
  if (address.postalCode) parts.push(address.postalCode);
  return parts.length ? parts.join(', ') : '—';
}

export function roleLabel(role = '', roles = {}) {
  return roles[role] || role;
}
