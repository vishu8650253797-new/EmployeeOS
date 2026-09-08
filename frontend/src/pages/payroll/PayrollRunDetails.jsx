import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Play, RotateCw, Send, CheckCircle2, XCircle, Lock, Ban, AlertTriangle } from 'lucide-react';
import { payrollRunService } from '../../services/payrollRunService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '../../utils/socketEvents';
import { formatDate, formatCurrencyFromMinorUnits } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { StatusBadge } from '../../components/ui/Badge';
import { TableSkeleton, StatCardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const VIEW_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];
const PREPARE_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];
const APPROVE_ROLES = ['SUPER_ADMIN', 'FINANCE'];

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <p className="text-[13px] text-ink-500">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight text-ink-900">{value}</p>
    </div>
  );
}

function ReasonModal({ open, title, onClose, onConfirm, loading, required }) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="danger" loading={loading} disabled={required && !reason.trim()} onClick={() => onConfirm(reason)}>Confirm</Button>
        </>
      }
    >
      <Input label="Reason" required={required} textarea rows={3} value={reason} onChange={setReason} placeholder="Explain why…" />
    </Modal>
  );
}

export default function PayrollRunDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const canView = VIEW_ROLES.includes(user?.role);
  const canPrepare = PREPARE_ROLES.includes(user?.role);
  const canApprove = APPROVE_ROLES.includes(user?.role);

  const [actionLoading, setActionLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data: run, loading, error, refetch } = useFetch(() => (canView ? payrollRunService.getRunById(id) : Promise.resolve(null)), [canView, id]);
  const { data: recordsData, loading: recordsLoading, refetch: refetchRecords } = useFetch(
    () => (canView ? payrollRunService.getRunRecords(id, { limit: 50 }) : Promise.resolve(null)),
    [canView, id]
  );
  const records = recordsData?.data || [];

  function refetchAll() {
    refetch();
    refetchRecords();
  }

  useSocketEvent(SOCKET_EVENTS.PAYROLL_RUN_CALCULATED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.PAYROLL_RUN_FAILED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.PAYROLL_RUN_SUBMITTED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.PAYROLL_RUN_APPROVED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.PAYROLL_RUN_REJECTED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.PAYROLL_RUN_FINALIZED, refetchAll, [refetchAll]);
  useSocketEvent(SOCKET_EVENTS.PAYROLL_RUN_CANCELLED, refetchAll, [refetchAll]);

  if (!canView) return <ErrorState title="No access" message="You don't have permission to view this payroll run." />;
  if (loading) return <LoadingState label="Loading payroll run…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!run) return null;

  async function runAction(action, successMessage) {
    setActionLoading(true);
    try {
      await action();
      toast.success(successMessage);
      refetchAll();
    } catch (err) {
      toast.error(err.message || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(reason) {
    setActionLoading(true);
    try {
      await payrollRunService.rejectRun(id, reason);
      toast.success('Payroll run rejected.');
      setRejectOpen(false);
      refetchAll();
    } catch (err) {
      toast.error(err.message || 'Failed to reject run.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel(reason) {
    setActionLoading(true);
    try {
      await payrollRunService.cancelRun(id, reason);
      toast.success('Payroll run cancelled.');
      setCancelOpen(false);
      refetchAll();
    } catch (err) {
      toast.error(err.message || 'Failed to cancel run.');
    } finally {
      setActionLoading(false);
    }
  }

  const canCancel = canPrepare && ['DRAFT', 'PROCESSING', 'CALCULATED', 'FAILED', 'REJECTED'].includes(run.status);

  return (
    <div>
      <PageHeader
        title="Payroll Run"
        subtitle={`Created ${formatDate(run.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={run.status} />
            {canPrepare && run.status === 'DRAFT' && (
              <Button size="sm" onClick={() => runAction(() => payrollRunService.processRun(id), 'Payroll processed.')} loading={actionLoading}>
                <Play size={14} />Process
              </Button>
            )}
            {canPrepare && ['CALCULATED', 'FAILED', 'REJECTED'].includes(run.status) && (
              <Button size="sm" variant="secondary" onClick={() => runAction(() => payrollRunService.recalculateRun(id), 'Payroll recalculated.')} loading={actionLoading}>
                <RotateCw size={14} />Recalculate
              </Button>
            )}
            {canPrepare && run.status === 'CALCULATED' && run.failedEmployees?.length === 0 && (
              <Button size="sm" onClick={() => runAction(() => payrollRunService.submitRun(id), 'Submitted for approval.')} loading={actionLoading}>
                <Send size={14} />Submit
              </Button>
            )}
            {canApprove && run.status === 'SUBMITTED' && (
              <>
                <Button size="sm" onClick={() => runAction(() => payrollRunService.approveRun(id), 'Payroll run approved.')} loading={actionLoading}>
                  <CheckCircle2 size={14} />Approve
                </Button>
                <Button size="sm" variant="dangerGhost" onClick={() => setRejectOpen(true)} disabled={actionLoading}>
                  <XCircle size={14} />Reject
                </Button>
              </>
            )}
            {canApprove && run.status === 'APPROVED' && (
              <Button size="sm" onClick={() => runAction(() => payrollRunService.finalizeRun(id), 'Payroll run finalized.')} loading={actionLoading}>
                <Lock size={14} />Finalize
              </Button>
            )}
            {canCancel && (
              <Button size="sm" variant="dangerGhost" onClick={() => setCancelOpen(true)} disabled={actionLoading}>
                <Ban size={14} />Cancel
              </Button>
            )}
          </div>
        }
      />

      {run.failedEmployees?.length > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger-600" aria-hidden="true" />
          <div>
            <p className="text-[13px] font-semibold text-danger-700">{run.failedEmployees.length} employee(s) failed calculation</p>
            <ul className="mt-1 space-y-0.5 text-xs text-danger-700">
              {run.failedEmployees.slice(0, 5).map((f, i) => <li key={i}>{f.error}</li>)}
            </ul>
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : (
          <>
            <StatCard label="Employees" value={run.employeeCount} />
            <StatCard label="Gross" value={formatCurrencyFromMinorUnits(run.totalGrossMinorUnits, run.currency)} />
            <StatCard label="Deductions" value={formatCurrencyFromMinorUnits(run.totalDeductionsMinorUnits, run.currency)} />
            <StatCard label="Net pay" value={formatCurrencyFromMinorUnits(run.totalNetPayMinorUnits, run.currency)} />
          </>
        )}
      </div>

      <TableContainer>
        {recordsLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : records.length === 0 ? (
          <EmptyState title="No records yet" message="Process this run to calculate payroll for eligible employees." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Employee</TH>
                <TH>Department</TH>
                <TH>Gross</TH>
                <TH>Deductions</TH>
                <TH>Net pay</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody>
              {records.map((record) => (
                <TR key={record.id} className="cursor-pointer" onClick={() => navigate(`/payroll/runs/${id}/records/${record.id}`)}>
                  <TD className="font-medium text-ink-900">{record.employeeSnapshot?.firstName} {record.employeeSnapshot?.lastName}</TD>
                  <TD>{record.employeeSnapshot?.departmentName || '—'}</TD>
                  <TD>{formatCurrencyFromMinorUnits(record.grossMinorUnits, record.currency)}</TD>
                  <TD>{formatCurrencyFromMinorUnits(record.totalDeductionsMinorUnits, record.currency)}</TD>
                  <TD className="font-medium text-ink-900">{formatCurrencyFromMinorUnits(record.netPayMinorUnits, record.currency)}</TD>
                  <TD><StatusBadge status={record.status} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </TableContainer>

      <ReasonModal open={rejectOpen} title="Reject payroll run" onClose={() => setRejectOpen(false)} onConfirm={handleReject} loading={actionLoading} required />
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => handleCancel('')}
        loading={actionLoading}
        title="Cancel payroll run"
        message="Are you sure you want to cancel this payroll run? Any calculated records will be discarded and the period will reopen."
        confirmLabel="Cancel run"
      />
    </div>
  );
}
