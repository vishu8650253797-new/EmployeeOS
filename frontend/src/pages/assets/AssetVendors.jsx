import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Truck, MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react';
import { assetVendorService } from '../../services/assetVendorService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { StatusBadge } from '../../components/ui/Badge';
import Dropdown, { DropdownItem, DropdownSeparator } from '../../components/ui/Dropdown';
import Pagination from '../../components/ui/Pagination';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const PAGE_SIZE = 10;
const INITIAL_FORM = { name: '', contactPerson: '', email: '', phone: '', address: '', website: '', notes: '' };
const MANAGE_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'IT_ADMIN'];

export default function AssetVendors() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data, loading, error, refetch } = useFetch(
    () => assetVendorService.getVendors({ search, includeInactive: true, page, limit: PAGE_SIZE }),
    [search, page]
  );
  const vendors = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: PAGE_SIZE, total: 0 };

  function openCreate() {
    setEditing(null);
    setForm(INITIAL_FORM);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(vendor) {
    setEditing(vendor);
    setForm({
      name: vendor.name,
      contactPerson: vendor.contactPerson || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      website: vendor.website || '',
      notes: vendor.notes || '',
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
    if (!form.name.trim()) next.name = 'Vendor name is required';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        await assetVendorService.updateVendor(editing.id, form);
        toast(`${form.name} updated.`);
      } else {
        await assetVendorService.createVendor(form);
        toast(`${form.name} added.`);
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast(err.message || 'Failed to save vendor. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await assetVendorService.deleteVendor(deleteTarget.id);
      toast(`${deleteTarget.name} deactivated.`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast(err.message || 'Failed to deactivate vendor. Please try again.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle="Manage the suppliers you purchase and service assets through"
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus size={15} />
              Add Vendor
            </Button>
          )
        }
      />

      <SearchInput
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Search vendors…"
        className="mb-4 sm:max-w-sm"
      />

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : vendors.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No vendors found"
            message={search ? 'Try a different search term.' : 'Add your first vendor to track purchases and warranties.'}
            actionLabel={search || !canManage ? undefined : 'Add Vendor'}
            onAction={search || !canManage ? undefined : openCreate}
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Vendor</TH>
                  <TH>Contact</TH>
                  <TH>Email</TH>
                  <TH>Phone</TH>
                  <TH>Assets</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {vendors.map((vendor) => (
                  <TR key={vendor.id}>
                    <TD>
                      <button
                        type="button"
                        onClick={() => navigate(`/assets/vendors/${vendor.id}`)}
                        className="focus-ring rounded-lg font-medium text-ink-900 hover:text-brand-700"
                      >
                        {vendor.name}
                      </button>
                    </TD>
                    <TD>{vendor.contactPerson || '—'}</TD>
                    <TD className="text-ink-500">{vendor.email || '—'}</TD>
                    <TD className="text-ink-500">{vendor.phone || '—'}</TD>
                    <TD>{vendor.assetCount}</TD>
                    <TD>
                      <StatusBadge status={vendor.isActive ? 'ACTIVE' : 'INACTIVE'} />
                    </TD>
                    <TD className="text-right">
                      <Dropdown
                        width="w-44"
                        trigger={({ open }) => (
                          <button
                            type="button"
                            aria-label={`Actions for ${vendor.name}`}
                            aria-expanded={open}
                            className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        )}
                      >
                        <DropdownItem icon={Eye} onClick={() => navigate(`/assets/vendors/${vendor.id}`)}>
                          View details
                        </DropdownItem>
                        {canManage && (
                          <>
                            <DropdownItem icon={Pencil} onClick={() => openEdit(vendor)}>
                              Edit
                            </DropdownItem>
                            <DropdownSeparator />
                            <DropdownItem icon={Trash2} danger onClick={() => setDeleteTarget(vendor)}>
                              Deactivate
                            </DropdownItem>
                          </>
                        )}
                      </Dropdown>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={pagination.page} totalItems={pagination.total} pageSize={pagination.limit} onPageChange={setPage} />
          </>
        )}
      </TableContainer>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit vendor' : 'Add vendor'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="vendor-form" loading={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add vendor'}
            </Button>
          </>
        }
      >
        <form id="vendor-form" onSubmit={handleSave} noValidate className="space-y-4">
          <Input label="Vendor name" required value={form.name} onChange={(v) => updateField('name', v)} error={errors.name} placeholder="e.g. Redington India" />
          <Input label="Contact person" value={form.contactPerson} onChange={(v) => updateField('contactPerson', v)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Email" type="email" value={form.email} onChange={(v) => updateField('email', v)} error={errors.email} />
            <Input label="Phone" type="tel" value={form.phone} onChange={(v) => updateField('phone', v)} />
          </div>
          <Input label="Website" value={form.website} onChange={(v) => updateField('website', v)} placeholder="https://…" />
          <Input label="Address" textarea value={form.address} onChange={(v) => updateField('address', v)} />
          <Input label="Notes" textarea value={form.notes} onChange={(v) => updateField('notes', v)} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Deactivate vendor"
        message={deleteTarget ? `Deactivate ${deleteTarget.name}? Their purchase and maintenance history is kept.` : ''}
        confirmLabel="Deactivate"
      />
    </div>
  );
}
