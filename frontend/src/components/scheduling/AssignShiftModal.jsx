import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { employeeScheduleService } from '../../services/employeeScheduleService';
import { shiftService } from '../../services/shiftService';
import { employeeService } from '../../services/employeeService';
import { departmentService } from '../../services/departmentService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { fullName } from '../../utils/format';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Input from '../ui/Input';
import SearchInput from '../ui/SearchInput';
import Tabs from '../ui/Tabs';

const DAYS = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' }, { value: 0, label: 'Sun' },
];

const INITIAL_FORM = {
  employeeId: '', employeeIds: [], departmentId: '', shiftId: '',
  effectiveFrom: '', effectiveTo: '', daysOfWeek: [1, 2, 3, 4, 5], reason: '',
};

export default function AssignShiftModal({ open, onClose, onDone }) {
  const { toast } = useToast();
  const [mode, setMode] = useState('single');
  const [form, setForm] = useState(INITIAL_FORM);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);

  const { data: empResponse } = useFetch(
    () => (open ? employeeService.getEmployees({ status: 'ACTIVE', limit: 1000 }) : Promise.resolve(null)),
    [open]
  );
  const { data: shiftResponse } = useFetch(
    () => (open ? shiftService.getShifts({ status: 'ACTIVE', limit: 100 }) : Promise.resolve(null)),
    [open]
  );
  const { data: departments } = useFetch(
    () => (open ? departmentService.getDepartments() : Promise.resolve(null)),
    [open]
  );
  const employees = empResponse?.data || [];
  const shifts = shiftResponse?.data || [];
  const filteredEmployees = employees.filter((e) => fullName(e).toLowerCase().includes(employeeSearch.trim().toLowerCase()));

  function reset() {
    setMode('single');
    setForm(INITIAL_FORM);
    setEmployeeSearch('');
    setErrors({});
    setWarnings([]);
    setBulkResults(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  const updateField = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
    setWarnings([]);
  }, []);

  function toggleDay(day) {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day) ? f.daysOfWeek.filter((d) => d !== day) : [...f.daysOfWeek, day].sort(),
    }));
  }

  function toggleBulkEmployee(id) {
    setForm((f) => ({
      ...f,
      employeeIds: f.employeeIds.includes(id) ? f.employeeIds.filter((e) => e !== id) : [...f.employeeIds, id],
    }));
  }

  // Live, non-blocking conflict/warning check for single-employee mode —
  // bulk mode skips this (too many combinations to check inline) and
  // instead surfaces per-employee outcomes after submission.
  useEffect(() => {
    if (mode !== 'single' || !form.employeeId || !form.shiftId || !form.effectiveFrom) {
      setWarnings([]);
      return undefined;
    }
    let cancelled = false;
    setValidating(true);
    const id = setTimeout(async () => {
      try {
        const result = await employeeScheduleService.validateAssignment({
          employeeId: form.employeeId, shiftId: form.shiftId,
          effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo || undefined,
          daysOfWeek: form.daysOfWeek,
        });
        if (!cancelled) setWarnings(result.warnings || []);
      } catch {
        if (!cancelled) setWarnings([]);
      } finally {
        if (!cancelled) setValidating(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(id); };
  }, [mode, form.employeeId, form.shiftId, form.effectiveFrom, form.effectiveTo, form.daysOfWeek]);

  function validateForm() {
    const next = {};
    if (!form.shiftId) next.shiftId = 'Select a shift';
    if (!form.effectiveFrom) next.effectiveFrom = 'Select a start date';
    if (mode === 'single' && !form.employeeId) next.employeeId = 'Select an employee';
    if (mode === 'bulk' && form.employeeIds.length === 0 && !form.departmentId) {
      next.employeeIds = 'Select at least one employee or a department';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    try {
      if (mode === 'single') {
        await employeeScheduleService.assign({
          employeeId: form.employeeId, shiftId: form.shiftId, effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo || undefined, daysOfWeek: form.daysOfWeek, reason: form.reason || undefined,
        });
        toast.success('Shift assigned.');
        handleClose();
        onDone?.();
      } else {
        const result = await employeeScheduleService.bulkAssign({
          shiftId: form.shiftId, effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo || undefined,
          daysOfWeek: form.daysOfWeek, reason: form.reason || undefined,
          employeeIds: form.employeeIds.length ? form.employeeIds : undefined,
          departmentId: form.departmentId || undefined,
        });
        setBulkResults(result);
        onDone?.();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to assign shift.');
    } finally {
      setSaving(false);
    }
  }

  function employeeLabel(id) {
    const emp = employees.find((e) => e.id === id);
    return emp ? `${fullName(emp)} (${emp.employeeId})` : id;
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Assign Shift"
      description="Assign an existing shift to one or more employees"
      size="lg"
      footer={
        bulkResults ? (
          <Button onClick={handleClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={handleClose} disabled={saving}>Cancel</Button>
            <Button type="submit" form="assign-shift-form" loading={saving}>
              {saving ? 'Assigning…' : mode === 'bulk' ? 'Assign to selected' : 'Assign Shift'}
            </Button>
          </>
        )
      }
    >
      {bulkResults ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-700">
            <span className="font-medium text-success-700">{bulkResults.successCount} succeeded</span>
            {bulkResults.failureCount > 0 && (
              <span className="text-danger-600"> · {bulkResults.failureCount} failed</span>
            )}
          </p>
          <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg border border-line p-2">
            {bulkResults.results.map((r) => (
              <div key={r.employeeId} className="flex items-start gap-2 text-[13px]">
                {r.success ? (
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success-600" />
                ) : (
                  <XCircle size={15} className="mt-0.5 shrink-0 text-danger-600" />
                )}
                <span className="text-ink-700">
                  {employeeLabel(r.employeeId)}
                  {!r.success && <span className="ml-1 text-danger-600">— {r.error}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <form id="assign-shift-form" onSubmit={handleSubmit} className="space-y-4">
          <Tabs
            tabs={[{ value: 'single', label: 'Single employee' }, { value: 'bulk', label: 'Multiple / department' }]}
            active={mode}
            onChange={(v) => { setMode(v); setErrors({}); setWarnings([]); }}
          />

          {mode === 'single' ? (
            <Select
              label="Employee"
              required
              value={form.employeeId}
              onChange={(v) => updateField('employeeId', v)}
              error={errors.employeeId}
              placeholder="Select an employee"
              options={employees.map((e) => ({ value: e.id, label: `${fullName(e)} (${e.employeeId})` }))}
            />
          ) : (
            <div className="space-y-2">
              <Select
                label="Department (optional — assigns everyone in it)"
                value={form.departmentId}
                onChange={(v) => updateField('departmentId', v)}
                placeholder="No department filter"
                options={(departments || []).map((d) => ({ value: d.id, label: d.name }))}
              />
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-700">Or select individual employees</p>
                <SearchInput value={employeeSearch} onChange={setEmployeeSearch} placeholder="Search employees…" className="mb-2" />
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-line-strong p-2">
                  {filteredEmployees.map((e) => (
                    <label key={e.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-[13px] text-ink-700 hover:bg-ink-400/5">
                      <input
                        type="checkbox"
                        checked={form.employeeIds.includes(e.id)}
                        onChange={() => toggleBulkEmployee(e.id)}
                        className="focus-ring h-4 w-4 rounded border-line-strong text-brand-600"
                      />
                      {fullName(e)} ({e.employeeId})
                    </label>
                  ))}
                  {filteredEmployees.length === 0 && <p className="px-1.5 py-1 text-[13px] text-ink-400">No employees match.</p>}
                </div>
                {errors.employeeIds && <p className="mt-1.5 text-xs text-danger-600">{errors.employeeIds}</p>}
              </div>
            </div>
          )}

          <Select
            label="Shift"
            required
            value={form.shiftId}
            onChange={(v) => updateField('shiftId', v)}
            error={errors.shiftId}
            placeholder="Select a shift"
            options={shifts.map((s) => ({ value: s.id, label: `${s.name} (${s.startTime}–${s.endTime})` }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Effective from" required type="date" value={form.effectiveFrom} onChange={(v) => updateField('effectiveFrom', v)} error={errors.effectiveFrom} />
            <Input label="Effective to (optional)" type="date" value={form.effectiveTo} onChange={(v) => updateField('effectiveTo', v)} error={errors.effectiveTo} />
          </div>

          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-700">Days of week</p>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`focus-ring rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                    form.daysOfWeek.includes(d.value)
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-line-strong text-ink-500 hover:border-ink-400'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <Input label="Reason (optional)" textarea rows={2} value={form.reason} onChange={(v) => updateField('reason', v)} />

          {mode === 'single' && (validating || warnings.length > 0) && (
            <div className="space-y-1.5 rounded-lg border border-warning-200 bg-warning-50 p-3">
              {validating ? (
                <p className="text-[13px] text-ink-500">Checking for conflicts…</p>
              ) : (
                warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-[13px] text-warning-800">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>{w.message}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
