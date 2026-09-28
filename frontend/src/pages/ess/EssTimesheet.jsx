import { Fragment, useCallback, useState } from 'react';
import { ClipboardCheck, Send, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { timesheetService } from '../../services/timesheetService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '../../utils/socketEvents';
import { formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { StatCardSkeleton, TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const HISTORY_LABELS = {
  TIMESHEET_SUBMITTED: 'Submitted',
  TIMESHEET_APPROVED: 'Approved',
  TIMESHEET_REJECTED: 'Rejected',
  TIMESHEET_RESUBMITTED: 'Resubmitted',
  TIMESHEET_REOPENED: 'Reopened for correction',
};

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
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayEntries]) => ({
      date,
      entries: dayEntries,
      totalMinutes: dayEntries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0),
    }));
}

export default function EssTimesheet() {
  const { toast } = useToast();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);

  const { data: current, loading, error, refetch } = useFetch(() => timesheetService.getCurrent(), []);
  const timesheet = current?.timesheet;

  const { data: entries, loading: entriesLoading } = useFetch(
    () => (timesheet ? timesheetService.getEntries(timesheet.id) : Promise.resolve([])),
    [timesheet?.id, timesheet?.entryCount]
  );

  const { data: periodsData, loading: periodsLoading } = useFetch(
    () => timesheetService.getTimesheets({ limit: 10 }),
    [timesheet?.status]
  );
  const previousPeriods = (periodsData?.data || []).filter((t) => t.id !== timesheet?.id);
  const reviewHistory = timesheet?.history || [];

  const refreshOnDecision = useCallback(() => refetch(), [refetch]);
  useSocketEvent(SOCKET_EVENTS.TIMESHEET_APPROVED, refreshOnDecision, [refreshOnDecision]);
  useSocketEvent(SOCKET_EVENTS.TIMESHEET_REJECTED, refreshOnDecision, [refreshOnDecision]);
  useSocketEvent(SOCKET_EVENTS.TIMESHEET_REOPENED, refreshOnDecision, [refreshOnDecision]);

  async function handlePrepare() {
    setPreparing(true);
    try {
      await timesheetService.prepare();
      refetch();
    } catch (err) {
      toast.error(err.message || 'Could not prepare timesheet.');
    } finally {
      setPreparing(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await timesheetService.submit(timesheet.id);
      toast.success('Timesheet submitted.');
      setSubmitOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Could not submit timesheet.');
      setSubmitOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResubmit() {
    setResubmitting(true);
    try {
      await timesheetService.resubmit(timesheet.id);
      toast.success('Timesheet resubmitted.');
      setResubmitOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Could not resubmit timesheet.');
      setResubmitOpen(false);
    } finally {
      setResubmitting(false);
    }
  }

  if (loading) return <LoadingState label="Loading your timesheet…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!current) return null;

  const days = groupByDate(entries || []);
  const isDraft = timesheet?.status === 'DRAFT';
  const isSubmitted = timesheet?.status === 'SUBMITTED';
  const isApproved = timesheet?.status === 'APPROVED';
  const isRejected = timesheet?.status === 'REJECTED';
  const isLocked = isSubmitted || isApproved || isRejected;

  return (
    <div>
      <PageHeader
        title="Timesheet"
        subtitle={`${formatDate(current.period.periodStart)} – ${formatDate(current.period.periodEnd)}`}
        actions={
          <>
            {timesheet && <StatusBadge status={timesheet.status} />}
            <Button variant="secondary" onClick={() => refetch()}>
              <RefreshCw size={14} />
              Refresh
            </Button>
            {!isLocked && (
              <Button onClick={handlePrepare} loading={preparing}>
                {timesheet ? 'Re-check entries' : 'Prepare Timesheet'}
              </Button>
            )}
            {isDraft && (
              <Button
                variant="primary"
                onClick={() => setSubmitOpen(true)}
                disabled={!timesheet.isReadyForSubmission}
              >
                <Send size={14} />
                Submit Timesheet
              </Button>
            )}
            {isRejected && (
              <Button
                variant="primary"
                onClick={() => setResubmitOpen(true)}
                disabled={!timesheet.isReadyForSubmission}
              >
                <Send size={14} />
                Resubmit Timesheet
              </Button>
            )}
          </>
        }
      />

      {!timesheet ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No timesheet prepared yet"
          message="Prepare your timesheet from this week's clock-in/clock-out entries to review and submit it."
          actionLabel="Prepare Timesheet"
          onAction={handlePrepare}
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <p className="text-[13px] text-ink-500">Total hours</p>
              <p className="mt-1.5 text-xl font-semibold tracking-tight text-ink-900">{formatMinutes(timesheet.totalMinutes)}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <p className="text-[13px] text-ink-500">Entries</p>
              <p className="mt-1.5 text-xl font-semibold tracking-tight text-ink-900">{timesheet.entryCount}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <p className="text-[13px] text-ink-500">{isLocked ? 'Submitted' : 'Prepared'}</p>
              <p className="mt-1.5 text-sm font-medium text-ink-900">
                {isLocked ? formatDate(timesheet.submittedAt) : formatDate(timesheet.createdAt)}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <p className="text-[13px] text-ink-500">{isApproved || isRejected ? 'Reviewed' : 'Ready to submit'}</p>
              {isApproved || isRejected ? (
                <p className="mt-1.5 text-sm font-medium text-ink-900">
                  {timesheet.reviewedAt ? formatDate(timesheet.reviewedAt) : '—'}
                  {timesheet.reviewedBy && ` · ${timesheet.reviewedBy.firstName} ${timesheet.reviewedBy.lastName}`}
                </p>
              ) : (
                <p className={`mt-1.5 text-sm font-medium ${timesheet.isReadyForSubmission ? 'text-success-700' : 'text-danger-700'}`}>
                  {isSubmitted ? 'Submitted' : timesheet.isReadyForSubmission ? 'Yes' : 'No — see errors below'}
                </p>
              )}
            </div>
          </div>

          {isRejected && timesheet.rejectionReason && (
            <div className="mb-6 rounded-xl border border-danger-600/20 bg-danger-50 p-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-danger-700">
                <AlertTriangle size={14} />
                Rejected
              </p>
              <p className="text-[13px] text-danger-700">{timesheet.rejectionReason}</p>
            </div>
          )}

          {timesheet.validationErrors?.length > 0 && (
            <div className="mb-4 rounded-xl border border-danger-600/20 bg-danger-50 p-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-danger-700">
                <AlertTriangle size={14} />
                Must be resolved before submitting
              </p>
              <ul className="space-y-1 text-[13px] text-danger-700">
                {timesheet.validationErrors.map((e, i) => <li key={i}>• {e.message}</li>)}
              </ul>
            </div>
          )}

          {timesheet.validationWarnings?.length > 0 && (
            <div className="mb-6 rounded-xl border border-warning-600/20 bg-warning-50 p-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-warning-700">
                <Info size={14} />
                Worth reviewing (won't block submission)
              </p>
              <ul className="space-y-1 text-[13px] text-warning-700">
                {timesheet.validationWarnings.map((w, i) => <li key={i}>• {w.message}</li>)}
              </ul>
            </div>
          )}

          <h2 className="mb-3 text-sm font-semibold text-ink-900">Daily entries</h2>
          <TableContainer>
            {entriesLoading ? (
              <TableSkeleton rows={4} cols={4} />
            ) : days.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="No entries in this period" message="Clock-in/clock-out entries for this week will appear here." />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Date</TH>
                    <TH>Clock-in</TH>
                    <TH>Clock-out</TH>
                    <TH>Duration</TH>
                    <TH>Notes</TH>
                  </tr>
                </THead>
                <TBody>
                  {days.map((day) => (
                    <Fragment key={day.date}>
                      {day.entries.map((e, i) => (
                        <TR key={e.id}>
                          <TD className="font-medium text-ink-900">{i === 0 ? formatDate(day.date) : ''}</TD>
                          <TD className="text-ink-500">{formatDate(e.startTime, { hour: 'numeric', minute: '2-digit' })}</TD>
                          <TD className="text-ink-500">{e.endTime ? formatDate(e.endTime, { hour: 'numeric', minute: '2-digit' }) : '—'}</TD>
                          <TD>{formatMinutes(e.durationMinutes || 0)}</TD>
                          <TD className="max-w-52 truncate text-ink-500" title={e.notes}>{e.notes || '—'}</TD>
                        </TR>
                      ))}
                    </Fragment>
                  ))}
                </TBody>
              </Table>
            )}
          </TableContainer>
        </>
      )}

      {reviewHistory.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold text-ink-900">Review history</h2>
          <div className="space-y-2 rounded-xl border border-line bg-surface p-4 shadow-card">
            {reviewHistory.map((h, i) => (
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
        </>
      )}

      <h2 className="mb-3 mt-8 text-sm font-semibold text-ink-900">Previous periods</h2>
      <TableContainer>
        {periodsLoading ? (
          <TableSkeleton rows={3} cols={4} />
        ) : previousPeriods.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="No previous timesheets" message="Past timesheet periods will show up here." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Period</TH>
                <TH>Status</TH>
                <TH>Total hours</TH>
                <TH>Submitted</TH>
              </tr>
            </THead>
            <TBody>
              {previousPeriods.map((t) => (
                <TR key={t.id}>
                  <TD className="font-medium text-ink-900">{formatDate(t.periodStart)} – {formatDate(t.periodEnd)}</TD>
                  <TD><StatusBadge status={t.status} /></TD>
                  <TD>{formatMinutes(t.totalMinutes)}</TD>
                  <TD className="text-ink-500">{t.submittedAt ? formatDate(t.submittedAt) : '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </TableContainer>

      <ConfirmDialog
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onConfirm={handleSubmit}
        loading={submitting}
        variant="primary"
        title="Submit timesheet"
        message={`Submit your timesheet for ${formatDate(current.period.periodStart)} – ${formatDate(current.period.periodEnd)}? You won't be able to make changes after submitting.`}
        confirmLabel="Submit"
      />

      <ConfirmDialog
        open={resubmitOpen}
        onClose={() => setResubmitOpen(false)}
        onConfirm={handleResubmit}
        loading={resubmitting}
        variant="primary"
        title="Resubmit timesheet"
        message="Resubmit this corrected timesheet for manager review?"
        confirmLabel="Resubmit"
      />
    </div>
  );
}
