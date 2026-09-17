import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarOff, Eye } from 'lucide-react';
import { essLeaveService } from '../../services/essLeaveService';
import { useFetch } from '../../hooks/useFetch';
import { useSocketEvent } from '../../hooks/useSocket';
import { SOCKET_EVENTS } from '../../utils/socketEvents';
import { formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Select from '../../components/ui/Select';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function EssLeaveHistory() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const [leaveTypeId, setLeaveTypeId] = useState('all');
  const [page, setPage] = useState(1);

  const { data: leaveTypes } = useFetch(() => essLeaveService.getLeaveTypes(), []);
  const { data, loading, error, refetch } = useFetch(
    () => essLeaveService.getRequests({
      status: status === 'all' ? '' : status,
      leaveTypeId: leaveTypeId === 'all' ? '' : leaveTypeId,
      page,
      limit: PAGE_SIZE,
    }),
    [status, leaveTypeId, page]
  );

  const requests = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: PAGE_SIZE, total: 0 };

  useSocketEvent(SOCKET_EVENTS.LEAVE_REQUEST_APPROVED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.LEAVE_REQUEST_REJECTED, refetch, [refetch]);
  useSocketEvent(SOCKET_EVENTS.LEAVE_REQUEST_CANCELLED, refetch, [refetch]);

  const leaveTypeOptions = [
    { value: 'all', label: 'All leave types' },
    ...(leaveTypes || []).map((t) => ({ value: t.id, label: t.name })),
  ];

  return (
    <div>
      <PageHeader title="Leave History" subtitle="Every leave request you've submitted" />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={STATUS_OPTIONS}
          className="sm:w-44"
        />
        <Select
          aria-label="Filter by leave type"
          value={leaveTypeId}
          onChange={(v) => { setLeaveTypeId(v); setPage(1); }}
          options={leaveTypeOptions}
          className="sm:w-48"
        />
      </div>

      <TableContainer>
        {loading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : requests.length === 0 ? (
          <EmptyState icon={CalendarOff} title="No leave requests found" message="Try adjusting your filters." />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Leave Type</TH>
                  <TH>Duration</TH>
                  <TH>Days</TH>
                  <TH>Submitted</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {requests.map((r) => (
                  <TR key={r.id}>
                    <TD><Badge tone="neutral" dot={false}>{r.leaveType}</Badge></TD>
                    <TD className="text-ink-500">{formatDate(r.startDate)} – {formatDate(r.endDate)}</TD>
                    <TD>{r.numberOfDays}</TD>
                    <TD className="text-ink-500">{formatDate(r.createdAt)}</TD>
                    <TD><StatusBadge status={r.status} /></TD>
                    <TD className="text-right">
                      <button
                        type="button"
                        aria-label="View request details"
                        onClick={() => navigate(`/ess/leave/${r.id}`)}
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
    </div>
  );
}
