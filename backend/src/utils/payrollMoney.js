// Payroll money utilities — integer MINOR-unit (paise/cents) arithmetic.
//
// Every payroll model in this app stores money as an integer count of minor
// units (e.g. paise), not major units like JobOffer.salary/Asset.purchasePrice
// elsewhere in the codebase. Payroll uniquely does repeated derived arithmetic
// (percentage-of-basic/gross, proration) where float drift would silently
// corrupt payslip totals — integer minor units keep every operation exact.
// Percentages are likewise stored as integer basis points (1 bp = 0.01%, so
// 4000 = 40.00%) rather than floats. See payrollCalculationEngine.js.

// Round-half-up to the nearest integer minor unit — the single, fixed
// tie-breaking rule used everywhere in payroll.
function roundMinorUnits(value) {
  return Math.round(value);
}

// basisPoints: integer, 10000 = 100%.
function percentageOfMinorUnits(baseMinorUnits, basisPoints) {
  return roundMinorUnits((baseMinorUnits * basisPoints) / 10000);
}

function sumMinorUnits(items, selector = (x) => x) {
  return items.reduce((sum, item) => sum + selector(item), 0);
}

// Scales an amount by paidDays/totalDaysInPeriod (e.g. a mid-period joiner or
// leaver). Returns the amount unchanged once the period is fully paid.
function prorate(amountMinorUnits, paidDays, totalDaysInPeriod) {
  if (!totalDaysInPeriod || paidDays >= totalDaysInPeriod) return amountMinorUnits;
  if (paidDays <= 0) return 0;
  return roundMinorUnits((amountMinorUnits * paidDays) / totalDaysInPeriod);
}

module.exports = {
  roundMinorUnits,
  percentageOfMinorUnits,
  sumMinorUnits,
  prorate,
};
