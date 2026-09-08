import { useEffect, useState } from 'react';
import { salaryStructureService } from '../../services/salaryStructureService';
import { employeeCompensationService } from '../../services/employeeCompensationService';
import { useToast } from '../../context/ToastContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

export default function AssignCompensationModal({ open, employeeId, employeeName, onClose, onAssigned }) {
  const { toast } = useToast();
  const [structures, setStructures] = useState([]);
  const [structureId, setStructureId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [ctcAnnual, setCtcAnnual] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStructureId('');
    setEffectiveFrom('');
    setCtcAnnual('');
    setRevisionReason('');
    setErrors({});
    salaryStructureService.getStructures({ isActive: 'true' }).then(setStructures).catch(() => setStructures([]));
  }, [open]);

  function validate() {
    const next = {};
    if (!structureId) next.structureId = 'Select a salary structure';
    if (!effectiveFrom) next.effectiveFrom = 'Effective date is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await employeeCompensationService.assignCompensation({
        employeeId,
        structureId,
        effectiveFrom,
        ctcAnnualMinorUnits: ctcAnnual ? Math.round(parseFloat(ctcAnnual) * 100) : undefined,
        revisionReason,
      });
      toast.success('Compensation assigned.');
      onAssigned?.();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to assign compensation.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign compensation"
      description={employeeName ? `Assign a salary structure to ${employeeName}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="assign-compensation-form" loading={saving}>{saving ? 'Assigning…' : 'Assign'}</Button>
        </>
      }
    >
      <form id="assign-compensation-form" onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Salary structure"
          required
          value={structureId}
          onChange={setStructureId}
          error={errors.structureId}
          placeholder="Select a structure…"
          options={structures.map((s) => ({ value: s.id, label: s.name }))}
        />
        <Input label="Effective from" required type="date" value={effectiveFrom} onChange={setEffectiveFrom} error={errors.effectiveFrom} />
        <Input label="Annual CTC (optional)" type="number" value={ctcAnnual} onChange={setCtcAnnual} hint="Informational total annual cost-to-company" />
        <Input label="Reason for revision (optional)" value={revisionReason} onChange={setRevisionReason} placeholder="e.g. Annual increment FY26" />
      </form>
    </Modal>
  );
}
