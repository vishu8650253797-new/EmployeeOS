import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { payrollRunService } from '../../services/payrollRunService';
import { payrollPeriodService } from '../../services/payrollPeriodService';
import { employeeService } from '../../services/employeeService';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { fullName } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import SearchInput from '../../components/ui/SearchInput';
import { ErrorState } from '../../components/ui/States';

const PREPARE_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }) }));

export default function PayrollRunForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const canPrepare = PREPARE_ROLES.includes(user?.role);

  const [runType, setRunType] = useState('REGULAR');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [finalizedPeriods, setFinalizedPeriods] = useState([]);
  const [payrollPeriodId, setPayrollPeriodId] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeResults, setEmployeeResults] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (runType !== 'SUPPLEMENTARY') return;
    payrollPeriodService.getPeriods({ status: 'FINALIZED' }).then(setFinalizedPeriods).catch(() => setFinalizedPeriods([]));
  }, [runType]);

  useEffect(() => {
    if (runType !== 'SUPPLEMENTARY' || !employeeSearch.trim()) {
      setEmployeeResults([]);
      return;
    }
    const t = setTimeout(() => {
      employeeService.getEmployees({ search: employeeSearch.trim(), limit: 10 })
        .then((res) => setEmployeeResults(res.data || []))
        .catch(() => setEmployeeResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [runType, employeeSearch]);

  function toggleEmployee(employee) {
    setSelectedEmployees((prev) =>
      prev.some((e) => e.id === employee.id) ? prev.filter((e) => e.id !== employee.id) : [...prev, employee]
    );
  }

  if (!canPrepare) {
    return <ErrorState title="No access" message="You don't have permission to create payroll runs." />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = runType === 'SUPPLEMENTARY'
        ? { runType, payrollPeriodId, employeeScope: selectedEmployees.map((e) => e.id) }
        : { runType, year: parseInt(year, 10), month: parseInt(month, 10) };
      const run = await payrollRunService.createRun(payload);
      toast.success('Payroll run created.');
      navigate(`/payroll/runs/${run.id}`);
    } catch (err) {
      toast.error(err.message || 'Failed to create payroll run.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="New Payroll Run" subtitle="Select a period to process payroll for" />

      <form onSubmit={handleSubmit} className="max-w-lg space-y-4 rounded-xl border border-line bg-surface p-5 shadow-card">
        <Select
          label="Run type"
          value={runType}
          onChange={setRunType}
          options={[
            { value: 'REGULAR', label: 'Regular — all active employees' },
            { value: 'SUPPLEMENTARY', label: 'Supplementary — an already-finalized period' },
          ]}
        />

        {runType === 'REGULAR' ? (
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Year"
              value={year}
              onChange={setYear}
              options={Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 2 + i)).map((y) => ({ value: y, label: y }))}
            />
            <Select label="Month" value={month} onChange={setMonth} options={MONTH_OPTIONS} />
          </div>
        ) : (
          <>
            <Select
              label="Finalized period"
              required
              value={payrollPeriodId}
              onChange={setPayrollPeriodId}
              placeholder="Select a finalized period…"
              options={finalizedPeriods.map((p) => ({ value: p.id, label: `${p.year}-${String(p.month).padStart(2, '0')}` }))}
            />
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-ink-700">
                Employees<span className="ml-0.5 text-danger-600" aria-hidden="true">*</span>
              </label>
              <SearchInput value={employeeSearch} onChange={setEmployeeSearch} placeholder="Search employees to add…" />
              {employeeResults.length > 0 && (
                <div className="mt-2 max-h-40 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                  {employeeResults.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleEmployee(e)}
                      className="focus-ring flex w-full items-center justify-between px-3 py-2 text-left text-[13px] transition-colors hover:bg-canvas"
                    >
                      <span>{fullName(e)}</span>
                      {selectedEmployees.some((s) => s.id === e.id) && <span className="text-xs text-brand-600">Added</span>}
                    </button>
                  ))}
                </div>
              )}
              {selectedEmployees.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedEmployees.map((e) => (
                    <span key={e.id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs text-brand-700">
                      {fullName(e)}
                      <button type="button" onClick={() => toggleEmployee(e)} aria-label={`Remove ${fullName(e)}`} className="focus-ring rounded-full">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/payroll/runs')} disabled={submitting}>Cancel</Button>
          <Button type="submit" loading={submitting} disabled={runType === 'SUPPLEMENTARY' && (!payrollPeriodId || selectedEmployees.length === 0)}>
            {submitting ? 'Creating…' : 'Create run'}
          </Button>
        </div>
      </form>
    </div>
  );
}
