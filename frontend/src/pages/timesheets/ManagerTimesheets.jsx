import { useEffect, useState } from 'react';
import { ClipboardCheck, Check, X, Eye, RotateCcw } from 'lucide-react';
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
import SearchInput from '../../components/ui/SearchInput';
import { StatusBadge } from '../../components/ui/Badge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Tooltip from '../../components/ui/Tooltip';
import Pagination from '../../components/ui/Pagination';
import { StatCardSkeleton, TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const PAGE_SIZE = 15;
const DEBOUNCE_MS = 300;

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

// Shared by both "reject a submitted timesheet" and "reopen an approved
// one" — both are, functionally, the same action (send it back with a
// mandatory reason), just from a different starting status. See
// timesheetService.js's reopenTimesheet for why this isn't a separate
// backend concept either.
function ReasonModal({ open, onClose, onSubmit, saving, title, confirmLabel, confirmVariant = 'danger', placeholder }) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open={open}
      onClose={() => { setReason(''); onClose(); }}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant={confirmVariant} onClick={() => onSubmit(reason)} loading={saving} disabled={!reason.trim()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Input label="Reason" required textarea rows={3} value={reason} onChange={setReason} placeholder={placeholder} />
    </Modal>
  );
}

const HISTORY_LABELS = {
  TIMESHEET_SUBMITTED: 'Submitted',
  TIMESHEET_APPROVED: 'Approved',
  TIMESHEET_REJECTED: 'Rejected',
  TIMESHEET_RESUBMITTED: 'Resubmitted',
  TIMESHEET_REOPENED: 'Reopened for correction',
};

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
  const [reopenOpen, setReopenOpen] = useState(false);
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

  async function handleReopen(reason) {
    setProcessing(true);
    try {
      await managerTimesheetService.reopen(timesheetId, reason);
      toast.success('Timesheet reopened.');
      setReopenOpen(false);
      onDecision();
    } catch (err) {
      toast.error(err.message || 'Could not reopen timesheet.');
    } finally {
      setProcessing(false);
    }
  }

  const days = groupByDate(entries || []);
  const isSubmitted = timesheet?.status === 'SUBMITTED';
  const isApproved = timesheet?.status === 'APPROVED';

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
        ) : isApproved ? (
          <>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button variant="secondary" onClick={() => setReopenOpen(true)}>
              <RotateCcw size={14} />
              Reopen for correction
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

          {timesheet.history?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-ink-400">Review history</p>
              <div className="space-y-2 rounded-lg border border-line bg-canvas p-3">
                {timesheet.history.map((h, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 text-[13px]">
                    <span className="text-ink-700">
                      {HISTORY_LABELS[h.action] || h.action}
                      {h.actor && ` · ${h.actor.firstName} ${h.actor.lastName}`}
                      {h.reason && <span className="block text-ink-500">"{h.reason}"</span>}
                    </span>
                    <span className="shrink-0 text-ink-400">{formatDate(h.at, { hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
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
      <ReasonModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onSubmit={handleReject}
        saving={processing}
        title="Reject timesheet"
        confirmLabel="Reject timesheet"
        confirmVariant="danger"
        placeholder="Let the employee know what needs to change"
      />
      <ReasonModal
        open={reopenOpen}
        onClose={() => setReopenOpen(false)}
        onSubmit={handleReopen}
        saving={processing}
        title="Reopen timesheet"
        confirmLabel="Reopen for correction"
        confirmVariant="secondary"
        placeholder="Let the employee know what needs to be corrected"
      />
    </Modal>
  );
}

export default function ManagerTimesheets() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('SUBMITTED');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  const { data, loading, error, refetch } = useFetch(
    () => managerTimesheetService.getTimesheets({ status: statusFilter, search: debouncedSearch || undefined, page, limit: PAGE_SIZE }),
    [statusFilter, debouncedSearch, page]
  );
  const timesheets = data?.data || [];
  const pagination = data?.pagination || { page: 1, total: 0 };

  const { data: summary, loading: summaryLoading, refetch: refetchSummary } = useFetch(
    () => managerTimesheetService.getSummary(),
    []
  );

  function refreshAll() {
    refetch();
    refetchSummary();
  }

  useSocketEvent(SOCKET_EVENTS.TIMESHEET_SUBMITTED, refreshAll, [refetch, refetchSummary]);
  useSocketEvent(SOCKET_EVENTS.TIMESHEET_APPROVED, refreshAll, [refetch, refetchSummary]);
  useSocketEvent(SOCKET_EVENTS.TIMESHEET_REJECTED, refreshAll, [refetch, refetchSummary]);
  useSocketEvent(SOCKET_EVENTS.TIMESHEET_RESUBMITTED, refreshAll, [refetch, refetchSummary]);
  useSocketEvent(SOCKET_EVENTS.TIMESHEET_REOPENED, refreshAll, [refetch, refetchSummary]);

  function handleDecision() {
    setDetailId(null);
    refreshAll();
  }

  const tabs = [
    { value: 'SUBMITTED', label: 'Pending review' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
  ];

  return (
    <div>
      <PageHeader title="Timesheets" subtitle="Review and approve your team's submitted timesheets" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          [
            { label: 'Total timesheets', value: summary?.totalTimesheets ?? 0 },
            { label: 'Pending review', value: summary?.byStatus?.SUBMITTED ?? 0 },
            { label: 'Approved', value: summary?.byStatus?.APPROVED ?? 0 },
            { label: 'Total hours', value: formatMinutes(summary?.totalMinutes ?? 0) },
          ].map((cell) => (
            <div key={cell.label} className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <p className="text-[13px] text-ink-500">{cell.label}</p>
              <p className="mt-1.5 text-xl font-semibold tracking-tight text-ink-900">{cell.value}</p>
            </div>
          ))
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={tabs} active={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} />
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by employee name or ID…" className="sm:max-w-xs" />
      </div>

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : timesheets.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing here"
            message={
              debouncedSearch
                ? `No results for "${debouncedSearch}".`
                : statusFilter === 'SUBMITTED' ? 'No timesheets are waiting for your review.' : `No ${statusFilter.toLowerCase()} timesheets yet.`
            }
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
