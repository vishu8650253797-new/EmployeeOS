import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Layers, MoreHorizontal, Pencil, Trash2, Eye } from 'lucide-react';
import { salaryStructureService } from '../../services/salaryStructureService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { StatusBadge } from '../../components/ui/Badge';
import Dropdown, { DropdownItem, DropdownSeparator } from '../../components/ui/Dropdown';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const VIEW_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];
const MANAGE_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];

export default function SalaryStructures() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const canView = VIEW_ROLES.includes(user?.role);
  const canManage = MANAGE_ROLES.includes(user?.role);

  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data, loading, error, refetch } = useFetch(
    () => (canView ? salaryStructureService.getStructures() : Promise.resolve([])),
    [canView]
  );
  const structures = (data || []).filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()));

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await salaryStructureService.deleteStructure(deleteTarget.id);
      toast.success(`${deleteTarget.name} deleted.`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to delete structure.');
    } finally {
      setDeleting(false);
    }
  }

  if (!canView) {
    return <ErrorState title="No access" message="You don't have permission to view salary structures." />;
  }

  return (
    <div>
      <PageHeader
        title="Salary Structures"
        subtitle="Templates of pay components assigned to employees"
        actions={canManage && <Button onClick={() => navigate('/payroll/structures/new')}><Plus size={15} />Add Structure</Button>}
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Search structures…" className="mb-4 sm:max-w-sm" />

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : structures.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No salary structures found"
            message={search ? 'Try a different search term.' : 'Create a structure to assign compensation to employees.'}
            actionLabel={search || !canManage ? undefined : 'Add Structure'}
            onAction={search || !canManage ? undefined : () => navigate('/payroll/structures/new')}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Components</TH>
                <TH>Currency</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {structures.map((structure) => (
                <TR key={structure.id}>
                  <TD>
                    <button type="button" onClick={() => navigate(`/payroll/structures/${structure.id}/edit`)} className="focus-ring rounded-lg text-left font-medium text-ink-900 hover:text-brand-700">
                      {structure.name}
                    </button>
                  </TD>
                  <TD>{structure.components?.length || 0}</TD>
                  <TD>{structure.currency}</TD>
                  <TD><StatusBadge status={structure.isActive ? 'ACTIVE' : 'INACTIVE'} /></TD>
                  <TD className="text-right">
                    <Dropdown
                      width="w-40"
                      trigger={({ open }) => (
                        <button type="button" aria-label={`Actions for ${structure.name}`} aria-expanded={open} className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700">
                          <MoreHorizontal size={16} />
                        </button>
                      )}
                    >
                      <DropdownItem icon={Eye} onClick={() => navigate(`/payroll/structures/${structure.id}/edit`)}>View / edit</DropdownItem>
                      {canManage && (
                        <>
                          <DropdownSeparator />
                          <DropdownItem icon={Trash2} danger onClick={() => setDeleteTarget(structure)}>Delete</DropdownItem>
                        </>
                      )}
                    </Dropdown>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </TableContainer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete structure"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.name}? This is only possible if no employee is currently assigned to it.` : ''}
        confirmLabel="Delete"
      />
    </div>
  );
}
