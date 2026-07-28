import { useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  Clock,
  UserX,
  CalendarOff,
  Percent,
  CalendarCheck,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { attendanceService } from '../../services/attendanceService';
import { departmentService } from '../../services/departmentService';
import { useFetch } from '../../hooks/useFetch';
import { useWebSocket } from '../../hooks/useWebSocket';
import { ATTENDANCE_STATUSES } from '../../data/attendance';
import { formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/Badge';
import { TableSkeleton, StatCardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import Button from '../../components/ui/Button';
import {
  TableContainer,
  Table,
  THead,
  TH,
  TBody,
  TR,
  TD,
} from '../../components/ui/Table';

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function Attendance() {
  const [date, setDate] = useState(today());
  const [departmentId, setDepartmentId] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const { data: departments, loading: deptLoading } = useFetch(
    () => departmentService.getDepartments(),
    []
  );

  const { data: summary, loading: summaryLoading } = useFetch(
    () => attendanceService.getStats({ date }),
    [date]
  );

  const {
    data: response,
    loading,
    error,
    refetch,
  } = useFetch(
    () =>
      attendanceService.getAttendance({
        date,
        departmentId: departmentId === 'all' ? undefined : departmentId,
        status: status === 'all' ? undefined : status,
        search: search.trim() || undefined,
        page,
        limit,
        sortBy: 'date',
        sortOrder: 'desc',
      }),
    [date, departmentId, status, search, page, limit]
  );

  const records = response?.records || [];
  const pagination = response?.pagination || { page: 1, totalPages: 1 };

  useEffect(() => {
    setPage(1);
  }, [date, departmentId, status, search]);

  const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5100';
  const { lastMessage } = useWebSocket(WS_URL);

  useEffect(() => {
    if (lastMessage?.type === 'attendance:updated') {
      refetch();
    }
  }, [lastMessage, refetch]);

  const statCards = summary
    ? [
        { label: 'Total Employees', value: summary.totalEmployees, icon: Users, tone: 'bg-brand-50 text-brand-600' },
        { label: 'Present', value: summary.present, icon: UserCheck, tone: 'bg-success-50 text-success-600' },
        { label: 'Late', value: summary.late, icon: Clock, tone: 'bg-warning-50 text-warning-600' },
        { label: 'Absent', value: summary.absent, icon: UserX, tone: 'bg-danger-50 text-danger-600' },
        { label: 'Attendance Rate', value: `${summary.attendanceRate}%`, icon: Percent, tone: 'bg-info-50 text-info-600' },
      ]
    : [];

  const departmentOptions = [
    { value: 'all', label: 'All departments' },
    ...(departments || []).map((d) => ({ value: d.id, label: d.name })),
  ];

  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    ...ATTENDANCE_STATUSES,
  ];

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Monitor employee attendance and working hours."
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {summaryLoading
          ? Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
          : statCards.map(({ label, value, icon: Icon, tone }) => (
              <Card key={label} className="flex items-start justify-between">
                <div>
                  <p className="text-[13px] font-medium text-ink-500">{label}</p>
                  <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-900">{value}</p>
                </div>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                  <Icon size={17} aria-hidden="true" />
                </span>
              </Card>
            ))}
      </div>

      {/* Filters */}
      <Card className="mt-5">
        <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <Input
            type="date"
            label="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="sm:w-44"
          />
          <Select
            label="Department"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            options={departmentOptions}
            placeholder="All departments"
            className="sm:w-48"
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={statusOptions}
            placeholder="All statuses"
            className="sm:w-44"
          />
          <Input
            type="text"
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, ID or email"
            icon={Search}
            className="sm:w-64"
          />
        </div>
      </Card>

      <TableContainer className="mt-5">
        {loading ? (
          <TableSkeleton rows={8} cols={10} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : records.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No attendance records"
            message="No records match the selected date and filters."
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Employee</TH>
                  <TH>Employee ID</TH>
                  <TH>Department</TH>
                  <TH>Date</TH>
                  <TH>Check In</TH>
                  <TH>Check Out</TH>
                  <TH>Working Hours</TH>
                  <TH>Late</TH>
                  <TH>Early Departure</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {records.map((record) => (
                  <TR key={record.id}>
                    <TD>
                      <span className="flex items-center gap-3">
                        <Avatar name={record.employeeName} size="sm" />
                        <span className="font-medium text-ink-900">{record.employeeName}</span>
                      </span>
                    </TD>
                    <TD className="text-ink-500">{record.employeeCode || '—'}</TD>
                    <TD>{record.department}</TD>
                    <TD className="text-ink-500">{formatDate(record.date)}</TD>
                    <TD className={record.checkInTime ? '' : 'text-ink-400'}>{record.checkInTime || '—'}</TD>
                    <TD className={record.checkOutTime ? '' : 'text-ink-400'}>{record.checkOutTime || '—'}</TD>
                    <TD>{record.workingHours}</TD>
                    <TD>{record.late}</TD>
                    <TD>{record.earlyDeparture}</TD>
                    <TD>
                      <StatusBadge status={record.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-line px-4 py-3">
                <span className="text-[13px] text-ink-500">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                  >
                    <ChevronLeft size={14} /> Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page === pagination.totalPages || loading}
                  >
                    Next <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </TableContainer>
    </div>
  );
}
