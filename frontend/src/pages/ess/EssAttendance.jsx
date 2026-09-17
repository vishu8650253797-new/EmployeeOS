import { useState } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { essAttendanceService } from '../../services/essAttendanceService';
import { useFetch } from '../../hooks/useFetch';
import { useSocketEvent } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '../../utils/socketEvents';
import { formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import { StatCardSkeleton, TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const PAGE_SIZE = 15;

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <p className="text-[13px] text-ink-500">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight text-ink-900">{value}</p>
    </div>
  );
}

function monthRange(monthDate) {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const toISODate = (d) => d.toISOString().slice(0, 10);
  return { startDate: toISODate(start), endDate: toISODate(end) };
}

export default function EssAttendance() {
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [page, setPage] = useState(1);
  const [detailTarget, setDetailTarget] = useState(null);

  const { startDate, endDate } = monthRange(monthDate);
  const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const { data: summary, loading: summaryLoading, refetch: refetchSummary } = useFetch(
    () => essAttendanceService.getMySummary({ startDate, endDate }),
    [startDate, endDate]
  );
  const { data, loading, error, refetch } = useFetch(
    () => essAttendanceService.getMyHistory({ startDate, endDate, page, limit: PAGE_SIZE }),
    [startDate, endDate, page]
  );

  const records = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: PAGE_SIZE, total: 0 };

  function refreshAll() {
    refetch();
    refetchSummary();
  }

  useSocketEvent(SOCKET_EVENTS.ATTENDANCE_UPDATED, refreshAll, [refreshAll]);

  function changeMonth(delta) {
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="My Attendance"
        subtitle="Review your attendance records and summary"
        actions={
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="icon" aria-label="Previous month" onClick={() => changeMonth(-1)}>
              <ChevronLeft size={15} />
            </Button>
            <span className="min-w-32 text-center text-[13px] font-medium text-ink-700">{monthLabel}</span>
            <Button variant="secondary" size="icon" aria-label="Next month" onClick={() => changeMonth(1)}>
              <ChevronRight size={15} />
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {summaryLoading ? (
          Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Present" value={summary?.present ?? 0} />
            <StatCard label="Late" value={summary?.late ?? 0} />
            <StatCard label="Absent" value={summary?.absent ?? 0} />
            <StatCard label="On leave" value={summary?.onLeave ?? 0} />
            <StatCard label="Half day" value={summary?.halfDay ?? 0} />
            <StatCard label="Attendance rate" value={`${summary?.attendanceRate ?? 0}%`} />
          </>
        )}
      </div>

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : records.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="No attendance records" message="No attendance was recorded for this period." />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Date</TH>
                  <TH>Check in</TH>
                  <TH>Check out</TH>
                  <TH>Hours</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {records.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-medium text-ink-900">{formatDate(r.date)}</TD>
                    <TD>{r.checkInTime || '—'}</TD>
                    <TD>{r.checkOutTime || '—'}</TD>
                    <TD>{r.workingHours || '—'}</TD>
                    <TD><StatusBadge status={r.status} /></TD>
                    <TD className="text-right">
                      <button
                        type="button"
                        aria-label={`View attendance for ${r.date}`}
                        onClick={() => setDetailTarget(r)}
                        className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700"
                      >
                        <Eye size={16} />
                      </button>
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
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title="Attendance details"
        footer={<Button variant="secondary" onClick={() => setDetailTarget(null)}>Close</Button>}
      >
        {detailTarget && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
            <div>
              <dt className="text-xs text-ink-400">Date</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{formatDate(detailTarget.date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Status</dt>
              <dd className="mt-0.5"><StatusBadge status={detailTarget.status} /></dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Check in</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{detailTarget.checkInTime || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Check out</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{detailTarget.checkOutTime || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Working hours</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{detailTarget.workingHours || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Late by</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{detailTarget.late || '—'}</dd>
            </div>
            {detailTarget.notes && (
              <div className="col-span-2">
                <dt className="text-xs text-ink-400">Notes</dt>
                <dd className="mt-0.5 text-ink-700">{detailTarget.notes}</dd>
              </div>
            )}
          </dl>
        )}
      </Modal>
    </div>
  );
}
