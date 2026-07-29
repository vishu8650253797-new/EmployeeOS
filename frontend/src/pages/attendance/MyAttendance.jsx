import { useEffect, useState } from 'react';
import {
  CalendarCheck,
  CalendarDays,
  Clock,
  UserCheck,
  UserX,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { attendanceService } from '../../services/attendanceService';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Card, { CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/Badge';
import { StatCardSkeleton, TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import {
  TableContainer,
  Table,
  THead,
  TH,
  TBody,
  TR,
  TD,
} from '../../components/ui/Table';

const MONTHS = [
  { value: '', label: 'All months' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

function generateYears() {
  const current = new Date().getFullYear();
  const years = [{ value: '', label: 'All years' }];
  for (let y = current; y >= current - 5; y -= 1) {
    years.push({ value: String(y), label: String(y) });
  }
  return years;
}

export default function MyAttendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const { data: today, loading: todayLoading, refetch: refetchToday } = useFetch(
    () => attendanceService.getToday(),
    []
  );

  const { data: summary, loading: summaryLoading, refetch: refetchSummary } = useFetch(
    () => (user?.employeeId ? attendanceService.getEmployeeSummary(user.employeeId, { month, year }) : Promise.resolve(null)),
    [user?.employeeId, month, year]
  );

  const { data: historyResponse, loading: historyLoading, error: historyError, refetch: refetchHistory } = useFetch(
    () =>
      attendanceService.getMyHistory({
        month: month || undefined,
        year: year || undefined,
        page,
        limit,
      }),
    [month, year, page, limit]
  );

  const historyRecords = historyResponse?.records || [];
  const pagination = historyResponse?.pagination || { page: 1, totalPages: 1 };

  useEffect(() => {
    setPage(1);
  }, [month, year]);

  async function handleCheckIn() {
    setCheckingIn(true);
    try {
      const record = await attendanceService.checkIn();
      toast(`Checked in at ${record.checkInTime}`);
      await Promise.all([refetchToday(), refetchSummary(), refetchHistory()]);
    } catch (err) {
      toast(err.message || 'Failed to check in', 'error');
    } finally {
      setCheckingIn(false);
    }
  }

  async function handleCheckOut() {
    setCheckingOut(true);
    try {
      const record = await attendanceService.checkOut();
      toast(`Checked out at ${record.checkOutTime}. Working hours: ${record.workingHours}`);
      await Promise.all([refetchToday(), refetchSummary(), refetchHistory()]);
    } catch (err) {
      toast(err.message || 'Failed to check out', 'error');
    } finally {
      setCheckingOut(false);
    }
  }

  const todayCard = todayLoading ? (
    <StatCardSkeleton />
  ) : (
    <Card className="flex flex-col justify-between">
      <div>
        <p className="text-[13px] font-medium text-ink-500">Today&apos;s Attendance</p>
        {!today?.checkedIn ? (
          <div className="mt-4">
            <p className="text-ink-700">You haven&apos;t checked in yet.</p>
            <Button className="mt-3" onClick={handleCheckIn} loading={checkingIn}>
              <CalendarCheck size={16} /> Check In
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-500">Check In</span>
              <span className="font-medium text-ink-900">{today.checkInTime}</span>
            </div>
            {today.checkedOut ? (
              <>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-500">Check Out</span>
                  <span className="font-medium text-ink-900">{today.checkOutTime}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-500">Working Hours</span>
                  <span className="font-medium text-ink-900">{today.workingHours}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink-500">Working Time</span>
                <span className="font-medium text-ink-900">{today.workingHours}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-500">Status</span>
              <StatusBadge status={today.status || 'PRESENT'} />
            </div>
            {!today.checkedOut && (
              <Button className="mt-3" onClick={handleCheckOut} loading={checkingOut}>
                <Clock size={16} /> Check Out
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );

  const summaryCells = summary
    ? [
        { label: 'Total Days', value: summary.totalDays, icon: CalendarDays, tone: 'bg-brand-50 text-brand-600' },
        { label: 'Present', value: summary.present, icon: UserCheck, tone: 'bg-success-50 text-success-600' },
        { label: 'Late', value: summary.late, icon: AlertTriangle, tone: 'bg-warning-50 text-warning-600' },
        { label: 'Absent', value: summary.absent, icon: UserX, tone: 'bg-danger-50 text-danger-600' },
        { label: 'Avg Hours', value: summary.averageWorkingHours, icon: Clock, tone: 'bg-info-50 text-info-600' },
        { label: 'Rate', value: `${summary.attendanceRate}%`, icon: UserCheck, tone: 'bg-success-50 text-success-600' },
      ]
    : [];

  const summaryCard = summaryLoading ? (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  ) : (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {summaryCells.map(({ label, value, icon: Icon, tone }) => (
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
  );

  return (
    <div>
      <PageHeader title="My Attendance" subtitle="View your attendance history and today&apos;s status." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">{todayCard}</div>
        <div className="lg:col-span-2">{summaryCard}</div>
      </div>

      <Card className="mt-5">
        <CardHeader title="Attendance History" />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Select
            label="Month"
            value={month}
            onChange={(v) => setMonth(v)}
            options={MONTHS}
            className="sm:w-44"
          />
          <Select
            label="Year"
            value={year}
            onChange={(v) => setYear(v)}
            options={generateYears()}
            className="sm:w-32"
          />
        </div>
      </Card>

      <TableContainer className="mt-5">
        {historyLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : historyError ? (
          <ErrorState message={historyError} onRetry={refetchHistory} />
        ) : historyRecords.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No attendance history"
            message="No attendance records found for the selected period."
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
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
                {historyRecords.map((record) => (
                  <TR key={record.id}>
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
                    disabled={page === 1 || historyLoading}
                  >
                    <ChevronLeft size={14} /> Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page === pagination.totalPages || historyLoading}
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
