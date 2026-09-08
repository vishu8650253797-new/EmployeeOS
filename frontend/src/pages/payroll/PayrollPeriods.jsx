import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CalendarRange, MoreHorizontal, Lock, Trash2 } from 'lucide-react';
import { payrollPeriodService } from '../../services/payrollPeriodService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { StatusBadge } from '../../components/ui/Badge';
import Dropdown, { DropdownItem, DropdownSeparator } from '../../components/ui/Dropdown';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const VIEW_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];
const PREPARE_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];
const APPROVE_ROLES = ['SUPER_ADMIN', 'FINANCE'];

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }) }));
const INITIAL_FORM = { year: String(new Date().getFullYear()), month: String(new Date().getMonth() + 1) };

export default function PayrollPeriods() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const canView = VIEW_ROLES.includes(user?.role);
  const canPrepare = PREPARE_ROLES.includes(user?.role);
  const canApprove = APPROVE_ROLES.includes(user?.role);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data, loading, error, refetch } = useFetch(() => (canView ? payrollPeriodService.getPeriods() : Promise.resolve([])), [canView]);
  const periods = data || [];

  const updateField = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await payrollPeriodService.createPeriod({ year: parseInt(form.year, 10), month: parseInt(form.month, 10) });
      toast.success('Payroll period created.');
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to create payroll period.');
    } finally {
      setSaving(false);
    }
  }

  async function handleClose(period) {
    try {
      await payrollPeriodService.closePeriod(period.id);
      toast.success('Payroll period closed.');
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to close payroll period.');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await payrollPeriodService.deletePeriod(deleteTarget.id);
      toast.success('Payroll period deleted.');
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to delete payroll period.');
    } finally {
      setDeleting(false);
    }
  }

  if (!canView) {
    return <ErrorState title="No access" message="You don't have permission to view payroll periods." />;
  }

  return (
    <div>
      <PageHeader
        title="Payroll Periods"
        subtitle="Calendar months and pay dates for payroll processing"
        actions={canPrepare && <Button onClick={() => setModalOpen(true)}><Plus size={15} />Add Period</Button>}
      />

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : periods.length === 0 ? (
          <EmptyState icon={CalendarRange} title="No payroll periods" message="Create your first payroll period to start processing payroll." actionLabel={canPrepare ? 'Add Period' : undefined} onAction={canPrepare ? () => setModalOpen(true) : undefined} />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Period</TH>
                <TH>Start</TH>
                <TH>End</TH>
                <TH>Pay date</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {periods.map((period) => (
                <TR key={period.id}>
                  <TD className="font-medium text-ink-900">{`${period.year}-${String(period.month).padStart(2, '0')}`}</TD>
                  <TD>{formatDate(period.startDate)}</TD>
                  <TD>{formatDate(period.endDate)}</TD>
                  <TD>{formatDate(period.payDate)}</TD>
                  <TD><StatusBadge status={period.status} /></TD>
                  <TD className="text-right">
                    <Dropdown
                      width="w-44"
                      trigger={({ open }) => (
                        <button type="button" aria-label={`Actions for ${period.year}-${period.month}`} aria-expanded={open} className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700">
                          <MoreHorizontal size={16} />
                        </button>
                      )}
                    >
                      <DropdownItem icon={CalendarRange} onClick={() => navigate(`/payroll/runs?payrollPeriodId=${period.id}`)}>View runs</DropdownItem>
                      {canApprove && period.status === 'FINALIZED' && (
                        <DropdownItem icon={Lock} onClick={() => handleClose(period)}>Close period</DropdownItem>
                      )}
                      {canPrepare && period.status === 'OPEN' && (
                        <>
                          <DropdownSeparator />
                          <DropdownItem icon={Trash2} danger onClick={() => setDeleteTarget(period)}>Delete</DropdownItem>
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add payroll period"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" form="period-form" loading={saving}>{saving ? 'Creating…' : 'Create period'}</Button>
          </>
        }
      >
        <form id="period-form" onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
          <Input label="Year" type="number" required value={form.year} onChange={(v) => updateField('year', v)} />
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-700">Month</label>
            <select
              value={form.month}
              onChange={(e) => updateField('month', e.target.value)}
              className="focus-ring h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink-900"
            >
              {MONTH_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete payroll period"
        message="Are you sure you want to delete this payroll period? This is only possible if it has no payroll runs."
        confirmLabel="Delete"
      />
    </div>
  );
}
