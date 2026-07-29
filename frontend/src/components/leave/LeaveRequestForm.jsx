import { useEffect, useMemo, useState } from 'react';
import { leaveTypeService } from '../../services/leaveTypeService';
import { leaveRequestService } from '../../services/leaveRequestService';
import { employeeService } from '../../services/employeeService';
import { useToast } from '../../context/ToastContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

const EMPTY_FORM = {
  employeeId: '',
  leaveTypeId: '',
  startDate: '',
  endDate: '',
  durationType: 'FULL_DAY',
  reason: '',
};

function countWorkingDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count += 1;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export default function LeaveRequestForm({ open, onClose, onSuccess, employeeId: fixedEmployeeId }) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    if (!open) return;

    setForm({ ...EMPTY_FORM, employeeId: fixedEmployeeId || '' });
    setErrors({});

    leaveTypeService
      .getLeaveTypes({ status: 'ACTIVE', limit: 100 })
      .then((res) => setLeaveTypes(res.data || []))
      .catch(() => setLeaveTypes([]));

    if (!fixedEmployeeId) {
      employeeService
        .getEmployees({ limit: 100 })
        .then((res) => setEmployees(res.data || res || []))
        .catch(() => setEmployees([]));
    }
  }, [open, fixedEmployeeId]);

  const selectedType = leaveTypes.find((t) => t.id === form.leaveTypeId);
  const allowHalfDay = Boolean(selectedType?.allowHalfDay);

  const estimatedDays = useMemo(() => {
    const days = countWorkingDays(form.startDate, form.endDate);
    return form.durationType === 'HALF_DAY' && allowHalfDay ? days * 0.5 : days;
  }, [form.startDate, form.endDate, form.durationType, allowHalfDay]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate() {
    const next = {};
    if (!form.employeeId) next.employeeId = 'Employee is required';
    if (!form.leaveTypeId) next.leaveTypeId = 'Leave type is required';
    if (!form.startDate) next.startDate = 'Start date is required';
    if (!form.endDate) next.endDate = 'End date is required';
    if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
      next.endDate = 'End date cannot be before start date';
    }
    if (form.startDate && form.endDate && estimatedDays <= 0) {
      next.endDate = 'Selected range has no working days';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await leaveRequestService.createLeaveRequest({
        employeeId: form.employeeId,
        leaveTypeId: form.leaveTypeId,
        startDate: form.startDate,
        endDate: form.endDate,
        durationType: allowHalfDay ? form.durationType : 'FULL_DAY',
        reason: form.reason.trim(),
      });
      toast('Leave request submitted.');
      onSuccess?.();
      onClose();
    } catch (err) {
      const message = err?.response?.data?.message || err.message || 'Failed to submit leave request.';
      toast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.employeeName || e.email,
  }));

  const leaveTypeOptions = leaveTypes.map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Apply for leave"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="leave-request-form" loading={submitting}>
            Submit request
          </Button>
        </>
      }
    >
      <form id="leave-request-form" onSubmit={handleSubmit} className="space-y-4">
        {!fixedEmployeeId && (
          <Select
            label="Employee"
            required
            placeholder="Select an employee"
            options={employeeOptions}
            value={form.employeeId}
            error={errors.employeeId}
            onChange={(e) => update('employeeId', e.target.value)}
          />
        )}

        <Select
          label="Leave type"
          required
          placeholder="Select a leave type"
          options={leaveTypeOptions}
          value={form.leaveTypeId}
          error={errors.leaveTypeId}
          onChange={(e) => update('leaveTypeId', e.target.value)}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            type="date"
            label="Start date"
            required
            value={form.startDate}
            error={errors.startDate}
            onChange={(e) => update('startDate', e.target.value)}
          />
          <Input
            type="date"
            label="End date"
            required
            value={form.endDate}
            error={errors.endDate}
            onChange={(e) => update('endDate', e.target.value)}
          />
        </div>

        {allowHalfDay && (
          <Select
            label="Duration"
            options={[
              { value: 'FULL_DAY', label: 'Full day' },
              { value: 'HALF_DAY', label: 'Half day' },
            ]}
            value={form.durationType}
            onChange={(e) => update('durationType', e.target.value)}
          />
        )}

        <div>
          <label htmlFor="leave-reason" className="mb-1.5 block text-[13px] font-medium text-ink-700">
            Reason
          </label>
          <textarea
            id="leave-reason"
            rows={3}
            value={form.reason}
            onChange={(e) => update('reason', e.target.value)}
            placeholder="Briefly describe the reason for your leave"
            className="focus-ring w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink-900 transition-colors placeholder:text-ink-400 hover:border-ink-400"
          />
        </div>

        {estimatedDays > 0 && (
          <p className="rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink-700">
            This request covers <span className="font-semibold">{estimatedDays}</span>{' '}
            {estimatedDays === 1 ? 'working day' : 'working days'} (weekends excluded).
          </p>
        )}
      </form>
    </Modal>
  );
}
