import { useCallback, useState } from 'react';
import { assetService } from '../../services/assetService';
import { departmentService } from '../../services/departmentService';
import { employeeService } from '../../services/employeeService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { fullName } from '../../utils/format';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Input from '../ui/Input';

export default function AssignAssetModal({ open, onClose, asset, onAssigned }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ employeeId: '', departmentId: '', assignmentNotes: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const { data: empResponse } = useFetch(
    () => (open ? employeeService.getEmployees({ status: 'ACTIVE', limit: 1000 }) : Promise.resolve(null)),
    [open]
  );
  const { data: departments } = useFetch(
    () => (open ? departmentService.getDepartments() : Promise.resolve(null)),
    [open]
  );
  const employees = empResponse?.data || [];

  const updateField = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }, []);

  function handleClose() {
    setForm({ employeeId: '', departmentId: '', assignmentNotes: '' });
    setErrors({});
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.employeeId) {
      setErrors({ employeeId: 'Select an employee to assign this asset to' });
      return;
    }
    setSaving(true);
    try {
      await assetService.assignAsset(asset.id, {
        employeeId: form.employeeId,
        departmentId: form.departmentId || undefined,
        assignmentNotes: form.assignmentNotes || undefined,
      });
      toast(`${asset.name} has been assigned.`);
      handleClose();
      onAssigned?.();
    } catch (err) {
      toast(err.message || 'Failed to assign asset. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!asset) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Assign Asset"
      description={`${asset.name} · ${asset.assetTag}`}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="assign-asset-form" loading={saving}>
            {saving ? 'Assigning…' : 'Assign Asset'}
          </Button>
        </>
      }
    >
      <form id="assign-asset-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Select
          label="Assign to"
          required
          value={form.employeeId}
          onChange={(v) => updateField('employeeId', v)}
          error={errors.employeeId}
          placeholder="Select an employee"
          options={employees.map((e) => ({ value: e.id, label: `${fullName(e)} (${e.employeeId})` }))}
        />
        <Select
          label="Department"
          value={form.departmentId}
          onChange={(v) => updateField('departmentId', v)}
          placeholder="Select department"
          options={(departments || []).map((d) => ({ value: d.id, label: d.name }))}
        />
        <Input
          label="Notes"
          textarea
          value={form.assignmentNotes}
          onChange={(v) => updateField('assignmentNotes', v)}
          placeholder="Optional assignment notes"
        />
      </form>
    </Modal>
  );
}
