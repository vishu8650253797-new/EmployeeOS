// Pure payroll calculation engine — no Mongoose, no DB access, no
// organizationId. Input is plain JS objects/arrays already merged from a
// SalaryStructure + EmployeeCompensation.componentOverrides one layer up (in
// salaryStructureService/payrollRunService); this module is agnostic of
// where values came from, which makes it directly unit-testable and reusable
// both for save-time structure validation (resolveEvaluationOrder) and
// run-time payroll calculation (calculate).
//
// Component shape expected in earningComponents/deductionComponents/
// employerContributionComponents:
//   { componentId, code, name, type, calculationType, percentageOfComponentId,
//     isProratable, value }
// `value` is minor units when calculationType is FIXED, or basis points
// (10000 = 100%) for any PERCENTAGE_* type. See utils/payrollMoney.js.

const { roundMinorUnits, percentageOfMinorUnits, sumMinorUnits, prorate } = require('../utils/payrollMoney');

class PayrollCalculationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PayrollCalculationError';
  }
}

// PERCENTAGE_OF_BASIC is sugar for PERCENTAGE_OF_COMPONENT targeting the
// structure's designated basic component — normalizing it here means the
// rest of the engine only has one percentage-of-component code path.
function normalizeComponent(component, basicComponentId) {
  if (component.calculationType === 'PERCENTAGE_OF_BASIC') {
    if (!basicComponentId) {
      throw new PayrollCalculationError(
        `Component "${component.code}" uses PERCENTAGE_OF_BASIC but no basic component is configured on the salary structure`
      );
    }
    return { ...component, calculationType: 'PERCENTAGE_OF_COMPONENT', percentageOfComponentId: basicComponentId.toString() };
  }
  return component;
}

// Resolves one "family" of components (earnings, deductions, or employer
// contributions) into { componentId, code, name, type, amountMinorUnits }
// line items (pre-proration). `resolvedById` accumulates resolved amounts
// across families so a later family (e.g. deductions) can reference an
// already-resolved component from an earlier one (e.g. an earning) —
// components may only reference an earlier-resolved family or their own;
// a forward reference (e.g. an earning referencing a deduction) is rejected.
// `grossBasisForPercentOfGross` is either the literal string 'SELF'
// (earnings: PERCENTAGE_OF_GROSS resolves against this family's own
// non-gross basis, computed in Pass C below) or a precomputed number (used
// by deductions/employer contributions, which resolve against the final
// earnings gross from the prior step).
function resolveFamily(components, { resolvedById, basicComponentId, grossBasisForPercentOfGross, familyLabel }) {
  const normalized = components.map((c) => normalizeComponent(c, basicComponentId));
  const byId = new Map(normalized.map((c) => [c.componentId.toString(), c]));

  // Pass A — FIXED components resolve immediately; percentage-based ones are
  // deferred (component-percentage to Pass B, gross-percentage to Pass D).
  const percentageNodes = [];
  const grossNodes = [];
  for (const c of normalized) {
    const id = c.componentId.toString();
    if (c.calculationType === 'FIXED') {
      resolvedById.set(id, roundMinorUnits(c.value));
    } else if (c.calculationType === 'PERCENTAGE_OF_GROSS') {
      grossNodes.push(c);
    } else if (c.calculationType === 'PERCENTAGE_OF_COMPONENT') {
      percentageNodes.push(c);
    } else {
      throw new PayrollCalculationError(`Component "${c.code}" has an unknown calculation type "${c.calculationType}"`);
    }
  }

  // Pass B — PERCENTAGE_OF_COMPONENT (incl. PERCENTAGE_OF_BASIC), resolved
  // via depth-first traversal with cycle detection (topological order falls
  // out of the recursion itself).
  const visiting = new Set();

  function resolveNode(component, chain) {
    const id = component.componentId.toString();
    if (resolvedById.has(id)) return resolvedById.get(id);
    if (visiting.has(id)) {
      throw new PayrollCalculationError(`Circular salary component reference detected: ${[...chain, component.code].join(' -> ')}`);
    }

    const targetId = component.percentageOfComponentId ? component.percentageOfComponentId.toString() : null;
    if (!targetId) {
      throw new PayrollCalculationError(`Component "${component.code}" has calculationType PERCENTAGE_OF_COMPONENT but no target component configured`);
    }

    visiting.add(id);
    let targetAmount;
    if (resolvedById.has(targetId)) {
      targetAmount = resolvedById.get(targetId);
    } else {
      const targetComponent = byId.get(targetId);
      if (!targetComponent) {
        throw new PayrollCalculationError(
          `Component "${component.code}" references a component that is not part of this ${familyLabel.toLowerCase()} group or has not been resolved yet (components may only reference an earlier-resolved component)`
        );
      }
      if (targetComponent.calculationType === 'PERCENTAGE_OF_GROSS') {
        throw new PayrollCalculationError(
          `Component "${component.code}" cannot reference "${targetComponent.code}" — a percentage-of-gross component cannot itself be a percentage target`
        );
      }
      targetAmount = resolveNode(targetComponent, [...chain, component.code]);
    }
    visiting.delete(id);

    const amount = percentageOfMinorUnits(targetAmount, component.value);
    resolvedById.set(id, amount);
    return amount;
  }

  percentageNodes.forEach((c) => resolveNode(c, []));

  // Pass C — the basis PERCENTAGE_OF_GROSS components in this family resolve against.
  const basis = grossBasisForPercentOfGross === 'SELF'
    ? sumMinorUnits(
        normalized.filter((c) => c.calculationType !== 'PERCENTAGE_OF_GROSS'),
        (c) => resolvedById.get(c.componentId.toString()) || 0
      )
    : grossBasisForPercentOfGross;

  // Pass D — PERCENTAGE_OF_GROSS.
  grossNodes.forEach((c) => {
    resolvedById.set(c.componentId.toString(), percentageOfMinorUnits(basis, c.value));
  });

  return normalized.map((c) => ({
    componentId: c.componentId,
    code: c.code,
    name: c.name,
    type: c.type || familyLabel,
    amountMinorUnits: resolvedById.get(c.componentId.toString()),
  }));
}

// Proration is orthogonal to how a value was computed, so it is applied once,
// uniformly, as a final adjustment — not folded into any calculationType's logic.
function applyProration(lineItems, proratableById, paidDays, totalDaysInPeriod) {
  const isProrationActive = paidDays < totalDaysInPeriod;
  return lineItems.map((item) => {
    const isProratable = Boolean(proratableById.get(item.componentId.toString()));
    const isProrated = isProratable && isProrationActive;
    const amountMinorUnits = isProratable ? prorate(item.amountMinorUnits, paidDays, totalDaysInPeriod) : item.amountMinorUnits;
    return { ...item, amountMinorUnits, isProrated };
  });
}

function calculate({
  earningComponents = [],
  deductionComponents = [],
  employerContributionComponents = [],
  basicComponentId = null,
  paidDays,
  totalDaysInPeriod,
}) {
  if (!totalDaysInPeriod || totalDaysInPeriod <= 0) {
    throw new PayrollCalculationError('totalDaysInPeriod must be a positive number');
  }
  if (paidDays == null || paidDays < 0) {
    throw new PayrollCalculationError('paidDays must be zero or a positive number');
  }

  const resolvedById = new Map();
  const proratableById = new Map();
  [...earningComponents, ...deductionComponents, ...employerContributionComponents].forEach((c) => {
    proratableById.set(c.componentId.toString(), Boolean(c.isProratable));
  });

  // Earnings resolve first (deductions/employer contributions may reference
  // an already-resolved earning, never the reverse).
  const earningsRaw = resolveFamily(earningComponents, {
    resolvedById, basicComponentId, grossBasisForPercentOfGross: 'SELF', familyLabel: 'EARNING',
  });
  const grossBeforeProration = sumMinorUnits(earningsRaw, (e) => e.amountMinorUnits);

  const deductionsRaw = resolveFamily(deductionComponents, {
    resolvedById, basicComponentId, grossBasisForPercentOfGross: grossBeforeProration, familyLabel: 'DEDUCTION',
  });

  // Employer contributions resolve last and never feed back into net pay.
  const employerContributionsRaw = resolveFamily(employerContributionComponents, {
    resolvedById, basicComponentId, grossBasisForPercentOfGross: grossBeforeProration, familyLabel: 'EMPLOYER_CONTRIBUTION',
  });

  const earnings = applyProration(earningsRaw, proratableById, paidDays, totalDaysInPeriod);
  const deductions = applyProration(deductionsRaw, proratableById, paidDays, totalDaysInPeriod);
  const employerContributions = applyProration(employerContributionsRaw, proratableById, paidDays, totalDaysInPeriod);

  const grossMinorUnits = sumMinorUnits(earnings, (e) => e.amountMinorUnits);
  const totalDeductionsMinorUnits = sumMinorUnits(deductions, (d) => d.amountMinorUnits);
  const netPayMinorUnits = grossMinorUnits - totalDeductionsMinorUnits;
  const totalEmployerContributionsMinorUnits = sumMinorUnits(employerContributions, (e) => e.amountMinorUnits);
  const totalEmployerCostMinorUnits = grossMinorUnits + totalEmployerContributionsMinorUnits;

  return {
    earnings,
    deductions,
    employerContributions,
    grossMinorUnits,
    totalDeductionsMinorUnits,
    netPayMinorUnits,
    totalEmployerCostMinorUnits,
  };
}

// Save-time validation for a salary structure — runs the exact same
// resolution logic as calculate() (guaranteeing zero drift between what gets
// validated and what actually runs), with proration disabled (paidDays ===
// totalDaysInPeriod), so a structure with a circular or invalid component
// reference is rejected the moment an admin saves it, long before any
// payroll run ever touches it. Throws PayrollCalculationError on failure.
function resolveEvaluationOrder({
  earningComponents = [], deductionComponents = [], employerContributionComponents = [], basicComponentId = null,
}) {
  calculate({
    earningComponents, deductionComponents, employerContributionComponents, basicComponentId,
    paidDays: 1, totalDaysInPeriod: 1,
  });
  return true;
}

module.exports = { calculate, resolveEvaluationOrder, PayrollCalculationError };
