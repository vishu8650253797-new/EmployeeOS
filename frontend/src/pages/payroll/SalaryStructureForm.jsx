import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { salaryStructureService } from '../../services/salaryStructureService';
import { salaryComponentService } from '../../services/salaryComponentService';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { LoadingState, ErrorState } from '../../components/ui/States';

const MANAGE_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];

const INITIAL_FORM = { name: '', description: '', currency: 'INR', basicComponentId: '', isActive: true, components: [] };

export default function SalaryStructureForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role);

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const components = await salaryComponentService.getComponents({ isActive: 'true' });
        setCatalog(components);

        if (isEdit) {
          const structure = await salaryStructureService.getStructureById(id);
          setForm({
            name: structure.name,
            description: structure.description || '',
            currency: structure.currency,
            basicComponentId: structure.basicComponentId || '',
            isActive: structure.isActive,
            components: (structure.components || []).map((c) => ({
              componentId: c.componentId,
              displayValue: c.value / 100,
              isOverridable: c.isOverridable,
            })),
          });
        }
      } catch (err) {
        setLoadError(err.message || 'Failed to load salary structure.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  const catalogById = new Map(catalog.map((c) => [c.id, c]));
  const usedIds = new Set(form.components.map((r) => r.componentId));
  const usesBasicPercentage = form.components.some((r) => catalogById.get(r.componentId)?.calculationType === 'PERCENTAGE_OF_BASIC');
  const basicOptions = catalog.filter((c) => c.type === 'EARNING');

  function updateField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }

  function addRow() {
    const next = catalog.find((c) => !usedIds.has(c.id));
    if (!next) return;
    setForm((f) => ({ ...f, components: [...f.components, { componentId: next.id, displayValue: 0, isOverridable: true }] }));
  }

  function updateRow(index, patch) {
    setForm((f) => ({ ...f, components: f.components.map((r, i) => (i === index ? { ...r, ...patch } : r)) }));
  }

  function removeRow(index) {
    setForm((f) => ({ ...f, components: f.components.filter((_, i) => i !== index) }));
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = 'Structure name is required';
    if (usesBasicPercentage && !form.basicComponentId) next.basicComponentId = 'Required because a component uses % of Basic';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        currency: form.currency,
        basicComponentId: form.basicComponentId || undefined,
        isActive: form.isActive,
        components: form.components.map((r) => ({
          componentId: r.componentId,
          value: Math.round(r.displayValue * 100),
          isOverridable: r.isOverridable,
        })),
      };
      if (isEdit) {
        await salaryStructureService.updateStructure(id, payload);
        toast.success('Salary structure updated.');
      } else {
        await salaryStructureService.createStructure(payload);
        toast.success('Salary structure created.');
      }
      navigate('/payroll/structures');
    } catch (err) {
      toast.error(err.message || 'Failed to save salary structure.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!canManage) {
    return <ErrorState title="No access" message="You don't have permission to manage salary structures." />;
  }
  if (loading) return <LoadingState label="Loading salary structure…" />;
  if (loadError) return <ErrorState message={loadError} />;

  return (
    <div>
      <PageHeader title={isEdit ? 'Edit Salary Structure' : 'New Salary Structure'} subtitle="Define the pay components this structure includes" />

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Name" required value={form.name} onChange={(v) => updateField('name', v)} error={errors.name} placeholder="Engineering L2" />
            <Input label="Currency" value={form.currency} onChange={(v) => updateField('currency', v.toUpperCase())} />
          </div>
          <Input className="mt-4" label="Description" textarea rows={2} value={form.description} onChange={(v) => updateField('description', v)} />
          {usesBasicPercentage && (
            <Select
              className="mt-4"
              label="Basic component"
              required
              value={form.basicComponentId}
              onChange={(v) => updateField('basicComponentId', v)}
              error={errors.basicComponentId}
              placeholder="Select the Basic component…"
              options={basicOptions.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
              hint="Required because one or more components below are calculated as a percentage of Basic"
            />
          )}
          <label className="mt-4 flex items-center gap-2 text-[13px] text-ink-700">
            <input type="checkbox" checked={form.isActive} onChange={(e) => updateField('isActive', e.target.checked)} className="focus-ring h-4 w-4 rounded border-line-strong text-brand-600" />
            Active
          </label>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Components</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addRow} disabled={usedIds.size >= catalog.length}>
              <Plus size={14} />
              Add component
            </Button>
          </div>

          {form.components.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-500">No components added yet.</p>
          ) : (
            <div className="space-y-3">
              {form.components.map((row, index) => {
                const meta = catalogById.get(row.componentId);
                const isPercentage = meta?.calculationType?.startsWith('PERCENTAGE');
                return (
                  <div key={index} className="flex flex-col gap-2 rounded-lg border border-line p-3 sm:flex-row sm:items-end">
                    <Select
                      label="Component"
                      className="sm:flex-1"
                      value={row.componentId}
                      onChange={(v) => updateRow(index, { componentId: v })}
                      options={catalog.filter((c) => c.id === row.componentId || !usedIds.has(c.id)).map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
                    />
                    <Input
                      label={isPercentage ? 'Percentage (%)' : 'Amount'}
                      type="number"
                      className="sm:w-32"
                      value={String(row.displayValue)}
                      onChange={(v) => updateRow(index, { displayValue: parseFloat(v) || 0 })}
                    />
                    <label className="flex items-center gap-2 pb-2.5 text-[13px] text-ink-700 sm:pb-0">
                      <input
                        type="checkbox"
                        checked={row.isOverridable}
                        onChange={(e) => updateRow(index, { isOverridable: e.target.checked })}
                        className="focus-ring h-4 w-4 rounded border-line-strong text-brand-600"
                      />
                      Overridable
                    </label>
                    <Button type="button" variant="dangerGhost" size="icon" aria-label="Remove component" onClick={() => removeRow(index)}>
                      <Trash2 size={15} />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/payroll/structures')} disabled={submitting}>Cancel</Button>
          <Button type="submit" loading={submitting}>{submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create structure'}</Button>
        </div>
      </form>
    </div>
  );
}
