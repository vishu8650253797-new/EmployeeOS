import { useCallback, useState } from 'react';
import { Plus, Sliders, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { salaryComponentService } from '../../services/salaryComponentService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { StatusBadge } from '../../components/ui/Badge';
import Dropdown, { DropdownItem, DropdownSeparator } from '../../components/ui/Dropdown';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const VIEW_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];
const MANAGE_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];

const COMPONENT_TYPES = [
  { value: 'EARNING', label: 'Earning' },
  { value: 'DEDUCTION', label: 'Deduction' },
  { value: 'EMPLOYER_CONTRIBUTION', label: 'Employer contribution' },
];
const CALCULATION_TYPES = [
  { value: 'FIXED', label: 'Fixed amount' },
  { value: 'PERCENTAGE_OF_BASIC', label: '% of Basic' },
  { value: 'PERCENTAGE_OF_GROSS', label: '% of Gross' },
  { value: 'PERCENTAGE_OF_COMPONENT', label: '% of another component' },
];

const INITIAL_FORM = {
  code: '', name: '', type: 'EARNING', calculationType: 'FIXED', percentageOfComponentId: '',
  isStatutory: false, isTaxable: true, isProratable: true, description: '',
};

export default function SalaryComponents() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canView = VIEW_ROLES.includes(user?.role);
  const canManage = MANAGE_ROLES.includes(user?.role);

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data, loading, error, refetch } = useFetch(
    () => (canView ? salaryComponentService.getComponents() : Promise.resolve([])),
    [canView]
  );
  const components = (data || []).filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()) || c.code.toLowerCase().includes(search.trim().toLowerCase()));
  const componentOptions = (data || []).filter((c) => c.calculationType !== 'PERCENTAGE_OF_GROSS' && c.id !== editing?.id);

  function openCreate() {
    setEditing(null);
    setForm(INITIAL_FORM);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(component) {
    setEditing(component);
    setForm({
      code: component.code, name: component.name, type: component.type, calculationType: component.calculationType,
      percentageOfComponentId: component.percentageOfComponentId || '',
      isStatutory: component.isStatutory, isTaxable: component.isTaxable, isProratable: component.isProratable,
      description: component.description || '',
    });
    setErrors({});
    setModalOpen(true);
  }

  const updateField = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }, []);

  function validate() {
    const next = {};
    if (!form.code.trim()) next.code = 'Code is required';
    if (!form.name.trim()) next.name = 'Name is required';
    if (form.calculationType === 'PERCENTAGE_OF_COMPONENT' && !form.percentageOfComponentId) {
      next.percentageOfComponentId = 'Select the component this percentage is based on';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        percentageOfComponentId: form.calculationType === 'PERCENTAGE_OF_COMPONENT' ? form.percentageOfComponentId : undefined,
      };
      if (editing) {
        await salaryComponentService.updateComponent(editing.id, payload);
        toast.success(`${form.name} updated.`);
      } else {
        await salaryComponentService.createComponent(payload);
        toast.success(`${form.name} created.`);
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to save component.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await salaryComponentService.deleteComponent(deleteTarget.id);
      toast.success(`${deleteTarget.name} deleted.`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to delete component.');
    } finally {
      setDeleting(false);
    }
  }

  if (!canView) {
    return <ErrorState title="No access" message="You don't have permission to view salary components." />;
  }

  return (
    <div>
      <PageHeader
        title="Salary Components"
        subtitle="The catalog of earnings, deductions, and employer contributions used in salary structures"
        actions={canManage && <Button onClick={openCreate}><Plus size={15} />Add Component</Button>}
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Search by name or code…" className="mb-4 sm:max-w-sm" />

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : components.length === 0 ? (
          <EmptyState
            icon={Sliders}
            title="No salary components found"
            message={search ? 'Try a different search term.' : 'Create components like Basic, HRA, or PF to build salary structures.'}
            actionLabel={search || !canManage ? undefined : 'Add Component'}
            onAction={search || !canManage ? undefined : openCreate}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Code</TH>
                <TH>Name</TH>
                <TH>Type</TH>
                <TH>Calculation</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {components.map((component) => (
                <TR key={component.id}>
                  <TD className="font-mono text-xs text-ink-500">{component.code}</TD>
                  <TD className="font-medium text-ink-900">{component.name}</TD>
                  <TD>{COMPONENT_TYPES.find((t) => t.value === component.type)?.label || component.type}</TD>
                  <TD>{CALCULATION_TYPES.find((t) => t.value === component.calculationType)?.label || component.calculationType}</TD>
                  <TD><StatusBadge status={component.isActive ? 'ACTIVE' : 'INACTIVE'} /></TD>
                  <TD className="text-right">
                    {canManage && (
                      <Dropdown
                        width="w-40"
                        trigger={({ open }) => (
                          <button type="button" aria-label={`Actions for ${component.name}`} aria-expanded={open} className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700">
                            <MoreHorizontal size={16} />
                          </button>
                        )}
                      >
                        <DropdownItem icon={Pencil} onClick={() => openEdit(component)}>Edit</DropdownItem>
                        <DropdownSeparator />
                        <DropdownItem icon={Trash2} danger onClick={() => setDeleteTarget(component)}>Delete</DropdownItem>
                      </Dropdown>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </TableContainer>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit component' : 'Add component'}
        description={editing ? `Update details for ${editing.name}` : 'Create a new salary component'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" form="component-form" loading={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create component'}</Button>
          </>
        }
      >
        <form id="component-form" onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Code" required value={form.code} onChange={(v) => updateField('code', v)} error={errors.code} uppercase placeholder="BASIC" />
            <Input label="Name" required value={form.name} onChange={(v) => updateField('name', v)} error={errors.name} placeholder="Basic Salary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" required value={form.type} onChange={(v) => updateField('type', v)} options={COMPONENT_TYPES} />
            <Select label="Calculation method" required value={form.calculationType} onChange={(v) => updateField('calculationType', v)} options={CALCULATION_TYPES} />
          </div>
          {form.calculationType === 'PERCENTAGE_OF_COMPONENT' && (
            <Select
              label="Percentage of"
              required
              value={form.percentageOfComponentId}
              onChange={(v) => updateField('percentageOfComponentId', v)}
              error={errors.percentageOfComponentId}
              placeholder="Select a component…"
              options={componentOptions.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
            />
          )}
          <Input label="Description" textarea rows={2} value={form.description} onChange={(v) => updateField('description', v)} />
          <div className="flex flex-wrap gap-4 pt-1">
            {[
              ['isStatutory', 'Statutory'],
              ['isTaxable', 'Taxable'],
              ['isProratable', 'Prorate on partial period'],
            ].map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 text-[13px] text-ink-700">
                <input
                  type="checkbox"
                  checked={form[field]}
                  onChange={(e) => updateField(field, e.target.checked)}
                  className="focus-ring h-4 w-4 rounded border-line-strong text-brand-600"
                />
                {label}
              </label>
            ))}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete component"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.name}? This is only possible if it isn't used by any salary structure.` : ''}
        confirmLabel="Delete"
      />
    </div>
  );
}
