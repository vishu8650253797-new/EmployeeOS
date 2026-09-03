import { useCallback, useState } from 'react';
import { offboardingService } from '../../services/offboardingService';
import { employeeService } from '../../services/employeeService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { fullName, formatDateForInput } from '../../utils/format';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Input from '../ui/Input';

const OFFBOARDING_TYPES = [
  { value: 'RESIGNATION', label: 'Resignation' },
  { value: 'TERMINATION', label: 'Termination' },
  { value: 'RETIREMENT', label: 'Retirement' },
  { value: 'CONTRACT_END', label: 'Contract End' },
  { value: 'LAYOFF', label: 'Layoff' },
  { value: 'OTHER', label: 'Other' },
];

const HR_ONLY_TYPES = ['TERMINATION', 'RETIREMENT', 'CONTRACT_END', 'LAYOFF', 'OTHER'];
const FULL_ROLES = ['SUPER_ADMIN', 'HR_ADMIN'];

const EMPTY_FORM = { employeeId: '', offboardingType: 'RESIGNATION', reason: '', lastWorkingDate: '', remarks: '' };

export default function InitiateOffboardingModal({ open, onClose, onInitiated }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isHR = FULL_ROLES.includes(user?.role);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const { data: empResponse } = useFetch(
    () => (open && isHR ? employeeService.getEmployees({ status: 'ACTIVE', limit: 1000 }) : Promise.resolve(null)),
    [open, isHR]
  );
  const employees = empResponse?.data || [];
  const typeOptions = isHR ? OFFBOARDING_TYPES : OFFBOARDING_TYPES.filter((t) => t.value === 'RESIGNATION');

  const updateField = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }, []);

  function handleClose() {
    setForm(EMPTY_FORM);
    setErrors({});
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (isHR && !form.employeeId) nextErrors.employeeId = 'Select an employee';
    if (!form.lastWorkingDate) nextErrors.lastWorkingDate = 'Last working date is required';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const created = await offboardingService.initiateOffboarding({
        employeeId: isHR ? form.employeeId : user.employeeId,
        offboardingType: form.offboardingType,
        reason: form.reason || undefined,
        lastWorkingDate: form.lastWorkingDate,
        remarks: form.remarks || undefined,
      });
      toast('Offboarding initiated.');
      handleClose();
      onInitiated?.(created);
    } catch (err) {
      toast(err.message || 'Failed to initiate offboarding. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Initiate Offboarding"
      description={isHR ? 'Start an exit process for an employee' : 'Submit your resignation'}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="initiate-offboarding-form" loading={saving}>
            {saving ? 'Starting…' : 'Initiate Offboarding'}
          </Button>
        </>
      }
    >
      <form id="initiate-offboarding-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {isHR && (
          <Select
            label="Employee"
            required
            value={form.employeeId}
            onChange={(v) => updateField('employeeId', v)}
            error={errors.employeeId}
            placeholder="Select an employee"
            options={employees.map((e) => ({ value: e.id, label: `${fullName(e)} (${e.employeeId})` }))}
          />
        )}
        <Select
          label="Offboarding Type"
          required
          value={form.offboardingType}
          onChange={(v) => updateField('offboardingType', v)}
          options={typeOptions}
        />
        {!isHR && HR_ONLY_TYPES.includes(form.offboardingType) === false && (
          <p className="text-xs text-ink-400">Only HR can initiate a termination, retirement, layoff or contract-end process.</p>
        )}
        <Input
          label="Last Working Date"
          type="date"
          required
          value={formatDateForInput(form.lastWorkingDate)}
          onChange={(v) => updateField('lastWorkingDate', v)}
          error={errors.lastWorkingDate}
        />
        <Input
          label="Reason"
          textarea
          value={form.reason}
          onChange={(v) => updateField('reason', v)}
          placeholder="Reason for leaving"
        />
        <Input
          label="Remarks"
          textarea
          value={form.remarks}
          onChange={(v) => updateField('remarks', v)}
          placeholder="Optional remarks"
        />
      </form>
    </Modal>
  );
}
