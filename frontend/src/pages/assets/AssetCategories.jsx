import { useCallback, useState } from 'react';
import { Plus, Layers, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { assetCategoryService } from '../../services/assetCategoryService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { StatusBadge } from '../../components/ui/Badge';
import Dropdown, { DropdownItem, DropdownSeparator } from '../../components/ui/Dropdown';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';

const INITIAL_FORM = { name: '', description: '', icon: 'Package' };
const MANAGE_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'IT_ADMIN'];

export default function AssetCategories() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role);

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data, loading, error, refetch } = useFetch(() => assetCategoryService.getCategories({ includeInactive: true }), []);
  const categories = (data || []).filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));

  function openCreate() {
    setEditing(null);
    setForm(INITIAL_FORM);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(category) {
    setEditing(category);
    setForm({ name: category.name, description: category.description || '', icon: category.icon || 'Package' });
    setErrors({});
    setModalOpen(true);
  }

  const updateField = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }, []);

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = 'Category name is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        await assetCategoryService.updateCategory(editing.id, form);
        toast(`${form.name} category updated.`);
      } else {
        await assetCategoryService.createCategory(form);
        toast(`${form.name} category created.`);
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast(err.message || 'Failed to save category. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await assetCategoryService.deleteCategory(deleteTarget.id);
      toast(result.message || `${deleteTarget.name} category removed.`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast(err.message || 'Failed to delete category. Please try again.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Asset Categories"
        subtitle="Organize your inventory into equipment types"
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus size={15} />
              Add Category
            </Button>
          )
        }
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Search categories…" className="mb-4 sm:max-w-sm" />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} lines={2} />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No categories found"
          message={search ? 'Try a different search term.' : 'Create your first asset category, e.g. Laptop or Monitor.'}
          actionLabel={search || !canManage ? undefined : 'Add Category'}
          onAction={search || !canManage ? undefined : openCreate}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <div
              key={category.id}
              className="rounded-xl border border-line bg-surface p-5 shadow-card transition-shadow hover:shadow-card-md"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Layers size={18} aria-hidden="true" />
                </span>
                {canManage && (
                  <Dropdown
                    width="w-40"
                    trigger={({ open }) => (
                      <button
                        type="button"
                        aria-label={`Actions for ${category.name}`}
                        aria-expanded={open}
                        className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    )}
                  >
                    <DropdownItem icon={Pencil} onClick={() => openEdit(category)}>
                      Edit
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem icon={Trash2} danger onClick={() => setDeleteTarget(category)}>
                      Delete
                    </DropdownItem>
                  </Dropdown>
                )}
              </div>

              <h3 className="mt-3 text-[15px] font-semibold text-ink-900">{category.name}</h3>
              <p className="mt-1 line-clamp-2 text-[13px] text-ink-500">{category.description || 'No description'}</p>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                <div>
                  <p className="text-xs text-ink-400">Assets</p>
                  <p className="text-[13px] font-medium text-ink-900">{category.assetCount}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-ink-400">Created</p>
                  <p className="text-[13px] font-medium text-ink-900">{formatDate(category.createdAt)}</p>
                </div>
                <StatusBadge status={category.isActive ? 'ACTIVE' : 'INACTIVE'} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit category' : 'Add category'}
        description={editing ? `Update details for ${editing.name}` : 'Create a new asset category'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="category-form" loading={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create category'}
            </Button>
          </>
        }
      >
        <form id="category-form" onSubmit={handleSave} noValidate className="space-y-4">
          <Input
            label="Category name"
            required
            value={form.name}
            onChange={(v) => updateField('name', v)}
            error={errors.name}
            placeholder="e.g. Laptop"
          />
          <Input
            label="Description"
            textarea
            value={form.description}
            onChange={(v) => updateField('description', v)}
            placeholder="What kind of equipment belongs here?"
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete category"
        message={
          deleteTarget
            ? `Are you sure you want to delete the ${deleteTarget.name} category? If assets still reference it, it will be deactivated instead.`
            : ''
        }
        confirmLabel="Delete"
      />
    </div>
  );
}
