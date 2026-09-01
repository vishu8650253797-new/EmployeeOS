import { useCallback, useState } from 'react';
import { assetService } from '../../services/assetService';
import { useToast } from '../../context/ToastContext';
import { MAINTENANCE_ISSUE_TYPES, PRIORITIES } from '../../data/assets';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Input from '../ui/Input';

const INITIAL_FORM = { issueType: 'OTHER', description: '', priority: 'MEDIUM' };

export default function ReportIssueModal({ open, onClose, asset, onReported }) {
  const { toast } = useToast();
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const updateField = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }, []);

  function handleClose() {
    setForm(INITIAL_FORM);
    setErrors({});
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.description.trim()) {
      setErrors({ description: 'Describe the issue' });
      return;
    }
    setSaving(true);
    try {
      await assetService.reportMaintenanceIssue(asset.id, form);
      toast('Issue reported. IT has been notified.');
      handleClose();
      onReported?.();
    } catch (err) {
      toast(err.message || 'Failed to report the issue. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!asset) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Report Asset Issue"
      description={`${asset.name} · ${asset.assetTag}`}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="report-issue-form" loading={saving}>
            {saving ? 'Submitting…' : 'Report Issue'}
          </Button>
        </>
      }
    >
      <form id="report-issue-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Select
          label="Issue type"
          value={form.issueType}
          onChange={(v) => updateField('issueType', v)}
          options={MAINTENANCE_ISSUE_TYPES}
        />
        <Select
          label="Priority"
          value={form.priority}
          onChange={(v) => updateField('priority', v)}
          options={PRIORITIES}
        />
        <Input
          label="Description"
          required
          textarea
          rows={4}
          value={form.description}
          onChange={(v) => updateField('description', v)}
          error={errors.description}
          placeholder="What's wrong with this asset?"
        />
      </form>
    </Modal>
  );
}
