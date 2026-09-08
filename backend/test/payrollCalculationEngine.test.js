const { calculate, resolveEvaluationOrder, PayrollCalculationError } = require('../src/services/payrollCalculationEngine');

// componentId is only ever used as a Map key (via .toString()) — plain
// strings are fine as fixtures and keep these tests readable.
function earning(id, calculationType, value, overrides = {}) {
  return { componentId: id, code: id, name: id, type: 'EARNING', calculationType, value, isProratable: true, ...overrides };
}
function deduction(id, calculationType, value, overrides = {}) {
  return { componentId: id, code: id, name: id, type: 'DEDUCTION', calculationType, value, isProratable: true, ...overrides };
}
function employerContribution(id, calculationType, value, overrides = {}) {
  return { componentId: id, code: id, name: id, type: 'EMPLOYER_CONTRIBUTION', calculationType, value, isProratable: true, ...overrides };
}

describe('payrollCalculationEngine.calculate', () => {
  test('fixed-only structure produces correct gross and net', () => {
    const result = calculate({
      earningComponents: [earning('BASIC', 'FIXED', 5000000), earning('TRANSPORT', 'FIXED', 200000)],
      deductionComponents: [deduction('PT', 'FIXED', 20000)],
      paidDays: 30,
      totalDaysInPeriod: 30,
    });

    expect(result.grossMinorUnits).toBe(5200000);
    expect(result.totalDeductionsMinorUnits).toBe(20000);
    expect(result.netPayMinorUnits).toBe(5180000);
  });

  test('PERCENTAGE_OF_BASIC resolves correctly given a fixed basic', () => {
    const result = calculate({
      earningComponents: [
        earning('BASIC', 'FIXED', 5000000),
        earning('HRA', 'PERCENTAGE_OF_BASIC', 4000), // 40%
      ],
      basicComponentId: 'BASIC',
      paidDays: 30,
      totalDaysInPeriod: 30,
    });

    const hra = result.earnings.find((e) => e.componentId === 'HRA');
    expect(hra.amountMinorUnits).toBe(2000000);
    expect(result.grossMinorUnits).toBe(7000000);
  });

  test('PERCENTAGE_OF_GROSS resolves against the gross of all non-gross earnings, independent of declaration order', () => {
    const forward = calculate({
      earningComponents: [
        earning('BASIC', 'FIXED', 5000000),
        earning('TRANSPORT', 'FIXED', 500000),
        earning('BONUS', 'PERCENTAGE_OF_GROSS', 1000), // 10% of the 5,500,000 non-gross basis
      ],
      paidDays: 30,
      totalDaysInPeriod: 30,
    });
    const reordered = calculate({
      earningComponents: [
        earning('BONUS', 'PERCENTAGE_OF_GROSS', 1000),
        earning('TRANSPORT', 'FIXED', 500000),
        earning('BASIC', 'FIXED', 5000000),
      ],
      paidDays: 30,
      totalDaysInPeriod: 30,
    });

    const bonus = forward.earnings.find((e) => e.componentId === 'BONUS');
    expect(bonus.amountMinorUnits).toBe(550000);
    expect(forward.grossMinorUnits).toBe(6050000);
    expect(reordered.grossMinorUnits).toBe(forward.grossMinorUnits);
  });

  test('PERCENTAGE_OF_COMPONENT chains correctly (A depends on B depends on C)', () => {
    const result = calculate({
      earningComponents: [
        earning('C', 'FIXED', 1000000),
        earning('B', 'PERCENTAGE_OF_COMPONENT', 5000, { percentageOfComponentId: 'C' }), // 50% of C
        earning('A', 'PERCENTAGE_OF_COMPONENT', 5000, { percentageOfComponentId: 'B' }), // 50% of B
      ],
      paidDays: 30,
      totalDaysInPeriod: 30,
    });

    const b = result.earnings.find((e) => e.componentId === 'B');
    const a = result.earnings.find((e) => e.componentId === 'A');
    expect(b.amountMinorUnits).toBe(500000);
    expect(a.amountMinorUnits).toBe(250000);
  });

  test('a circular reference (A -> B -> A) throws PayrollCalculationError', () => {
    expect(() =>
      calculate({
        earningComponents: [
          earning('A', 'PERCENTAGE_OF_COMPONENT', 5000, { percentageOfComponentId: 'B' }),
          earning('B', 'PERCENTAGE_OF_COMPONENT', 5000, { percentageOfComponentId: 'A' }),
        ],
        paidDays: 30,
        totalDaysInPeriod: 30,
      })
    ).toThrow(PayrollCalculationError);
  });

  test('a component referencing a PERCENTAGE_OF_GROSS component is rejected', () => {
    expect(() =>
      calculate({
        earningComponents: [
          earning('BONUS', 'PERCENTAGE_OF_GROSS', 1000),
          earning('SUB_BONUS', 'PERCENTAGE_OF_COMPONENT', 5000, { percentageOfComponentId: 'BONUS' }),
        ],
        paidDays: 30,
        totalDaysInPeriod: 30,
      })
    ).toThrow(/percentage-of-gross/);
  });

  test('PERCENTAGE_OF_BASIC without a configured basicComponentId is rejected', () => {
    expect(() =>
      calculate({
        earningComponents: [earning('HRA', 'PERCENTAGE_OF_BASIC', 4000)],
        paidDays: 30,
        totalDaysInPeriod: 30,
      })
    ).toThrow(PayrollCalculationError);
  });

  test('deductions resolve after and using the earnings final gross', () => {
    const result = calculate({
      earningComponents: [earning('BASIC', 'FIXED', 5000000), earning('TRANSPORT', 'FIXED', 500000)],
      deductionComponents: [deduction('TDS', 'PERCENTAGE_OF_GROSS', 1000)], // 10% of gross (5,500,000)
      paidDays: 30,
      totalDaysInPeriod: 30,
    });

    const tds = result.deductions.find((d) => d.componentId === 'TDS');
    expect(tds.amountMinorUnits).toBe(550000);
    expect(result.netPayMinorUnits).toBe(result.grossMinorUnits - 550000);
  });

  test('a deduction can reference an already-resolved earning', () => {
    const result = calculate({
      earningComponents: [earning('BASIC', 'FIXED', 5000000)],
      deductionComponents: [deduction('PF', 'PERCENTAGE_OF_COMPONENT', 1200, { percentageOfComponentId: 'BASIC' })], // 12% of basic
      paidDays: 30,
      totalDaysInPeriod: 30,
    });

    const pf = result.deductions.find((d) => d.componentId === 'PF');
    expect(pf.amountMinorUnits).toBe(600000);
  });

  test('an earning cannot forward-reference a deduction', () => {
    expect(() =>
      calculate({
        earningComponents: [earning('BONUS', 'PERCENTAGE_OF_COMPONENT', 5000, { percentageOfComponentId: 'PF' })],
        deductionComponents: [deduction('PF', 'FIXED', 100000)],
        paidDays: 30,
        totalDaysInPeriod: 30,
      })
    ).toThrow(PayrollCalculationError);
  });

  test('employer contributions affect totalEmployerCostMinorUnits but never netPayMinorUnits', () => {
    const result = calculate({
      earningComponents: [earning('BASIC', 'FIXED', 5000000)],
      deductionComponents: [deduction('PF_EMPLOYEE', 'PERCENTAGE_OF_COMPONENT', 1200, { percentageOfComponentId: 'BASIC' })],
      employerContributionComponents: [employerContribution('PF_EMPLOYER', 'PERCENTAGE_OF_COMPONENT', 1200, { percentageOfComponentId: 'BASIC' })],
      paidDays: 30,
      totalDaysInPeriod: 30,
    });

    expect(result.netPayMinorUnits).toBe(5000000 - 600000);
    expect(result.totalEmployerCostMinorUnits).toBe(result.grossMinorUnits + 600000);
  });

  test('proration scales every isProratable component and leaves non-proratable ones untouched', () => {
    const result = calculate({
      earningComponents: [
        earning('BASIC', 'FIXED', 3000000, { isProratable: true }),
        earning('JOINING_BONUS', 'FIXED', 500000, { isProratable: false }),
      ],
      paidDays: 15,
      totalDaysInPeriod: 30,
    });

    const basic = result.earnings.find((e) => e.componentId === 'BASIC');
    const bonus = result.earnings.find((e) => e.componentId === 'JOINING_BONUS');
    expect(basic.amountMinorUnits).toBe(1500000);
    expect(basic.isProrated).toBe(true);
    expect(bonus.amountMinorUnits).toBe(500000);
    expect(bonus.isProrated).toBe(false);
  });

  test('proration is deterministic under round-half-up for a non-exact split', () => {
    // 999 minor units at 15/30 days = exactly 499.5 -> rounds to 500 (round-half-up).
    const result = calculate({
      earningComponents: [earning('ALLOWANCE', 'FIXED', 999, { isProratable: true })],
      paidDays: 15,
      totalDaysInPeriod: 30,
    });
    expect(result.earnings[0].amountMinorUnits).toBe(500);
  });

  test('rounding never causes the sum of components to disagree with the reported gross', () => {
    const result = calculate({
      earningComponents: [
        earning('BASIC', 'FIXED', 333333),
        earning('HRA', 'PERCENTAGE_OF_BASIC', 3333), // 33.33%
        earning('BONUS', 'PERCENTAGE_OF_GROSS', 777), // 7.77%
      ],
      basicComponentId: 'BASIC',
      paidDays: 17,
      totalDaysInPeriod: 30,
    });

    const summed = result.earnings.reduce((sum, e) => sum + e.amountMinorUnits, 0);
    expect(summed).toBe(result.grossMinorUnits);
  });

  test('paidDays equal to totalDaysInPeriod applies no proration', () => {
    const result = calculate({
      earningComponents: [earning('BASIC', 'FIXED', 1000000, { isProratable: true })],
      paidDays: 30,
      totalDaysInPeriod: 30,
    });
    expect(result.earnings[0].amountMinorUnits).toBe(1000000);
    expect(result.earnings[0].isProrated).toBe(false);
  });
});

describe('payrollCalculationEngine.resolveEvaluationOrder', () => {
  test('accepts a valid structure', () => {
    expect(() =>
      resolveEvaluationOrder({
        earningComponents: [earning('BASIC', 'FIXED', 5000000), earning('HRA', 'PERCENTAGE_OF_BASIC', 4000)],
        basicComponentId: 'BASIC',
      })
    ).not.toThrow();
  });

  test('rejects a structure with a circular component reference', () => {
    expect(() =>
      resolveEvaluationOrder({
        earningComponents: [
          earning('A', 'PERCENTAGE_OF_COMPONENT', 5000, { percentageOfComponentId: 'B' }),
          earning('B', 'PERCENTAGE_OF_COMPONENT', 5000, { percentageOfComponentId: 'A' }),
        ],
      })
    ).toThrow(PayrollCalculationError);
  });
});
