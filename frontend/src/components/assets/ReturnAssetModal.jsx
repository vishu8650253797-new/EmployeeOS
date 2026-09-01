import { useCallback, useState } from 'react';
import { assetService } from '../../services/assetService';
import { useToast } from '../../context/ToastContext';
import { fullName } from '../../utils/format';
import { ASSET_CONDITIONS } from '../../data/assets';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Input from '../ui/Input';

const INITIAL_FORM = { condition: '', returnNotes: '' };

export default function ReturnAssetModal({ open, onClose, asset, onReturned }) {
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
    if (!form.condition) {
      setErrors({ condition: 'Select the condition the asset was returned in' });
      return;
    }
    setSaving(true);
    try {
      await assetService.returnAsset(asset.id, form);
      toast(`${asset.name} has been marked as returned.`);
      handleClose();
      onReturned?.();
    } catch (err) {
      toast(err.message || 'Failed to record the return. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!asset) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Return Asset"
      description={`${asset.name} · returning from ${asset.assignedTo ? fullName(asset.assignedTo) : 'current holder'}`}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="return-asset-form" loading={saving}>
            {saving ? 'Recording…' : 'Confirm Return'}
          </Button>
        </>
      }
    >
      <form id="return-asset-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="rounded-lg bg-canvas px-3 py-2 text-[13px] text-ink-500">
          Current condition: <span className="font-medium text-ink-900">{asset.condition}</span>
        </div>
        <Select
          label="Condition on return"
          required
          value={form.condition}
          onChange={(v) => updateField('condition', v)}
          error={errors.condition}
          placeholder="Select condition"
          options={ASSET_CONDITIONS}
        />
        <Input
          label="Damage / return notes"
          textarea
          value={form.returnNotes}
          onChange={(v) => updateField('returnNotes', v)}
          placeholder="Note any damage, missing accessories, or other details"
        />
        <p className="text-xs text-ink-400">
          Returning it as Damaged automatically opens a maintenance record for inspection.
        </p>
      </form>
    </Modal>
  );
}
