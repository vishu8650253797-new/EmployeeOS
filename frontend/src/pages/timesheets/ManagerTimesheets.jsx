import { useState } from 'react';
import { ClipboardCheck, Check, X, Eye } from 'lucide-react';
import { managerTimesheetService } from '../../services/managerTimesheetService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '../../utils/socketEvents';
import { formatDate, fullName } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Avatar from '../../components/ui/Avatar';
import Tabs from '../../components/ui/Tabs';
import { StatusBadge } from '../../components/ui/Badge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Tooltip from '../../components/ui/Tooltip';
import Pagination from '../../components/ui/Pagination';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const PAGE_SIZE = 15;

function formatMinutes(minutes = 0) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function groupByDate(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.entryDate)) groups.set(entry.entryDate, []);
    groups.get(entry.entryDate).push(entry);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, list]) => ({ date, entries: list }));
}

function RejectModal({ open, onClose, onSubmit, saving }) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open={open}
      onClose={() => { setReason(''); onClose(); }}
      title="Reject timesheet"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="danger" onClick={() => onSubmit(reason)} loading={saving} disabled={!reason.trim()}>
            Reject timesheet
          </Button>
        </>
      }
    >
      <Input label="Reason" required textarea rows={3} value={reason} onChange={setReason} placeholder="Let the employee know what needs to change" />
    </Modal>
  );
}

function TimesheetDetailModal({ timesheetId, onClose, onDecision }) {
  const { data: timesheet, loading, refetch } = useFetch(
    () => (timesheetId ? managerTimesheetService.getById(timesheetId) : Promise.resolve(null)),
    [timesheetId]
  );
  const { data: entries, loading: entriesLoading } = useFetch(
    () => (timesheetId ? managerTimesheetService.getEntries(timesheetId) : Promise.resolve([])),
    [timesheetId]
  );
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  async function handleApprove() {
    setProcessing(true);
    try {
      await managerTimesheetService.approve(timesheetId);
      toast.success('Timesheet approved.');
      setApproveOpen(false);
      onDecision();
    } catch (err) {
      toast.error(err.message || 'Could not approve timesheet.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject(reason) {
    setProcessing(true);
    try {
      await managerTimesheetService.reject(timesheetId, reason);
      toast.success('Timesheet rejected.');
      setRejectOpen(false);
      onDecision();
    } catch (err) {
      toast.error(err.message || 'Could not reject timesheet.');
    } finally {
      setProcessing(false);
    }
  }

  const days = groupByDate(entries || []);
  const isSubmitted = timesheet?.status === 'SUBMITTED';

  return (
    <Modal
      open={Boolean(timesheetId)}
      onClose={onClose}
      size="lg"
      title={timesheet ? `${fullName(timesheet.employee)}'s timesheet` : 'Timesheet'}
      footer={
        isSubmitted ? (
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(true)}>
              <X size={14} />
              Reject
            </Button>
            <Button onClick={() => setApproveOpen(true)}>
              <Check size={14} />
              Approve
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>Close</Button>
        )
      }
    >
      {loading || !timesheet ? (
        <p className="text-[13px] text-ink-500">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={fullName(timesheet.employee)} size="md" />
            <div>
              <p className="text-sm font-semibold text-ink-900">{fullName(timesheet.employee)}</p>
              <p className="text-[13px] text-ink-500">{timesheet.employee?.department || timesheet.employee?.jobTitle || '—'}</p>
            </div>
            <StatusBadge status={timesheet.status} className="ml-auto" />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-line bg-canvas p-4 text-[13px] sm:grid-cols-3">
            <div>
              <dt className="text-xs text-ink-400">Period</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{formatDate(timesheet.periodStart)} – {formatDate(timesheet.periodEnd)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Total hours</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{formatMinutes(timesheet.totalMinutes)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Entries</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{timesheet.entryCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Submitted</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{timesheet.submittedAt ? formatDate(timesheet.submittedAt) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Reviewed by</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{timesheet.reviewedBy ? fullName(timesheet.reviewedBy) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Reviewed on</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{timesheet.reviewedAt ? formatDate(timesheet.reviewedAt) : '—'}</dd>
            </div>
          </dl>

          {timesheet.validationWarnings?.length > 0 && (
            <div className="rounded-lg border border-warning-600/20 bg-warning-50 p-3">
              <p className="text-xs font-medium text-warning-700">Warnings</p>
              <ul className="mt-1 space-y-0.5 text-[13px] text-warning-700">
                {timesheet.validationWarnings.map((w, i) => <li key={i}>• {w.message}</li>)}
              </ul>
            </div>
          )}

          {timesheet.rejectionReason && (
            <div className="rounded-lg border border-danger-600/20 bg-danger-50 p-3">
              <p className="text-xs font-medium text-danger-700">Rejection reason</p>
              <p className="mt-1 text-[13px] text-danger-700">{timesheet.rejectionReason}</p>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-ink-400">Daily entries</p>
            {entriesLoading ? (
              <TableSkeleton rows={3} cols={3} />
            ) : days.length === 0 ? (
              <p className="text-[13px] text-ink-500">No entries.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
                <Table>
                  <THead>
                    <tr>
                      <TH>Date</TH>
                      <TH>Clock-in</TH>
                      <TH>Clock-out</TH>
                      <TH>Duration</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {days.flatMap((day) => day.entries.map((e, i) => (
                      <TR key={e.id}>
                        <TD className="font-medium text-ink-900">{i === 0 ? formatDate(day.date) : ''}</TD>
                        <TD className="text-ink-500">{formatDate(e.startTime, { hour: 'numeric', minute: '2-digit' })}</TD>
                        <TD className="text-ink-500">{e.endTime ? formatDate(e.endTime, { hour: 'numeric', minute: '2-digit' }) : '—'}</TD>
                        <TD>{formatMinutes(e.durationMinutes || 0)}</TD>
                      </TR>
                    )))}
                  </TBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        onConfirm={handleApprove}
        loading={processing}
        variant="primary"
        title="Approve timesheet"
        message={timesheet ? `Approve ${fullName(timesheet.employee)}'s timesheet for ${formatDate(timesheet.periodStart)} – ${formatDate(timesheet.periodEnd)}?` : ''}
        confirmLabel="Approve"
      />
      <RejectModal open={rejectOpen} onClose={() => setRejectOpen(false)} onSubmit={handleReject} saving={processing} />
    </Modal>
  );
}

export default function ManagerTimesheets() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('SUBMITTED');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState(null);

  const { data, loading, error, refetch } = useFetch(
    () => managerTimesheetService.getTimesheets({ status: statusFilter, page, limit: PAGE_SIZE }),
    [statusFilter, page]
  );
  const timesheets = data?.data || [];
  const pagination = data?.pagination || { page: 1, total: 0 };

  useSocketEvent(SOCKET_EVENTS.TIMESHEET_APPROVED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.TIMESHEET_REJECTED, refetch, [refetch]);

  function handleDecision() {
    setDetailId(null);
    refetch();
  }

  const tabs = [
    { value: 'SUBMITTED', label: 'Pending review' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
  ];

  return (
    <div>
      <PageHeader title="Timesheets" subtitle="Review and approve your team's submitted timesheets" />

      <Tabs tabs={tabs} active={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} className="mb-4" />

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : timesheets.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing here"
            message={statusFilter === 'SUBMITTED' ? 'No timesheets are waiting for your review.' : `No ${statusFilter.toLowerCase()} timesheets yet.`}
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Employee</TH>
                  <TH>Period</TH>
                  <TH>Total hours</TH>
                  <TH>Submitted</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {timesheets.map((t) => (
                  <TR key={t.id} className="cursor-pointer" onClick={() => setDetailId(t.id)}>
                    <TD>
                      <span className="flex items-center gap-3">
                        <Avatar name={fullName(t.employee)} size="sm" />
                        <span>
                          <span className="block font-medium text-ink-900">{fullName(t.employee)}</span>
                          <span className="block text-xs text-ink-400">{t.employee?.department || t.employee?.jobTitle}</span>
                        </span>
                      </span>
                    </TD>
                    <TD className="text-ink-500">{formatDate(t.periodStart)} – {formatDate(t.periodEnd)}</TD>
                    <TD>{formatMinutes(t.totalMinutes)}</TD>
                    <TD className="text-ink-500">{t.submittedAt ? formatDate(t.submittedAt) : '—'}</TD>
                    <TD><StatusBadge status={t.status} /></TD>
                    <TD className="text-right">
                      <Tooltip label="Review">
                        <button
                          type="button"
                          aria-label={`Review ${fullName(t.employee)}'s timesheet`}
                          onClick={(e) => { e.stopPropagation(); setDetailId(t.id); }}
                          className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700"
                        >
                          <Eye size={16} />
                        </button>
                      </Tooltip>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={pagination.page} totalItems={pagination.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </TableContainer>

      <TimesheetDetailModal timesheetId={detailId} onClose={() => setDetailId(null)} onDecision={handleDecision} />
    </div>
  );
}
