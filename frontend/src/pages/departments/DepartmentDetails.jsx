import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Building2, Users, CalendarDays, UserRound, CalendarCheck, Clock, UserCheck, UserX } from 'lucide-react';
import { departmentService } from '../../services/departmentService';
import { employeeService } from '../../services/employeeService';
import { attendanceService } from '../../services/attendanceService';
import { useFetch } from '../../hooks/useFetch';
import { formatDate, fullName } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Card, { CardHeader } from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/Badge';
import { CardSkeleton, TableSkeleton } from '../../components/ui/Skeleton';
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

export default function DepartmentDetails() {
  const { id } = useParams();

  const {
    data: department,
    loading: deptLoading,
    error: deptError,
    refetch: refetchDept,
  } = useFetch(() => departmentService.getDepartmentById(id), [id]);

  const { data: empResponse, loading: empLoading } = useFetch(
    () => employeeService.getEmployees({ department: id, limit: 1000 }),
    [id]
  );

  const members = empResponse?.data || [];

  const today = () => new Date().toISOString().split('T')[0];
  const [attDate, setAttDate] = useState(today());

  const { data: deptStats, loading: statsLoading } = useFetch(
    () => attendanceService.getDepartmentStats(id, { date: attDate }),
    [id, attDate]
  );

  const { data: deptAttendance, loading: attLoading } = useFetch(
    () => attendanceService.getDepartmentAttendance(id, { date: attDate, limit: 10 }),
    [id, attDate]
  );

  const attendanceRecords = deptAttendance?.records || [];

  if (deptLoading) {
    return (
      <div className="space-y-4">
        <CardSkeleton lines={3} />
        <CardSkeleton lines={6} />
      </div>
    );
  }

  if (deptError) {
    return (
      <ErrorState
        title="Department not found"
        message="This department may have been removed or the link is incorrect."
        onRetry={refetchDept}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={department.name}
        breadcrumbs={[
          { label: 'Departments', to: '/departments' },
          { label: department.name },
        ]}
      />

      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Building2 size={24} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-ink-900">
                {department.name}
              </h2>
              <span className="rounded-md bg-ink-400/10 px-1.5 py-0.5 text-[11px] font-semibold text-ink-500">
                {department.code}
              </span>
              <StatusBadge status={department.status} />
            </div>
            <p className="mt-1 text-[13px] text-ink-500">{department.description}</p>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-6 sm:text-right">
            <div>
              <p className="flex items-center gap-1 text-xs text-ink-400 sm:justify-end">
                <UserRound size={12} /> Head
              </p>
              <p className="mt-0.5 text-[13px] font-medium text-ink-900">{department.head || '—'}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs text-ink-400 sm:justify-end">
                <Users size={12} /> Members
              </p>
              <p className="mt-0.5 text-[13px] font-medium text-ink-900">{department.employeeCount}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs text-ink-400 sm:justify-end">
                <CalendarDays size={12} /> Created
              </p>
              <p className="mt-0.5 text-[13px] font-medium text-ink-900">{formatDate(department.createdAt)}</p>
            </div>
          </div>
        </div>
      </Card>

      <CardHeader
        title="Team members"
        subtitle={`${department.employeeCount} employees in this department`}
        className="mb-3"
      />

      <TableContainer>
        {empLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No employees in this department"
            message="Assign employees to this department from their profile."
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Employee</TH>
                <TH>Employee ID</TH>
                <TH>Job Title</TH>
                <TH>Status</TH>
                <TH>Joined</TH>
              </tr>
            </THead>
            <TBody>
              {members.map((employee) => (
                <TR key={employee.id}>
                  <TD>
                    <Link
                      to={`/employees/${employee.id}`}
                      className="focus-ring flex items-center gap-3 rounded-lg"
                    >
                      <Avatar name={fullName(employee)} size="sm" />
                      <span>
                        <span className="block font-medium text-ink-900">{fullName(employee)}</span>
                        <span className="block text-xs text-ink-400">{employee.email}</span>
                      </span>
                    </Link>
                  </TD>
                  <TD className="text-ink-500">{employee.employeeId}</TD>
                  <TD>{employee.jobTitle}</TD>
                  <TD>
                    <StatusBadge status={employee.status} />
                  </TD>
                  <TD className="text-ink-500">{formatDate(employee.joiningDate)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </TableContainer>

      <CardHeader
        title="Attendance"
        subtitle={`Attendance overview for ${formatDate(attDate)}`}
        className="mb-3 mt-6"
      />

      <div className="mb-4">
        <input
          type="date"
          value={attDate}
          onChange={(e) => setAttDate(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-900"
        />
      </div>

      {statsLoading ? (
        <p className="text-[13px] text-ink-500">Loading department statistics…</p>
      ) : deptStats ? (
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <p className="text-[13px] text-ink-500">Attendance rate</p>
            <p className="mt-1.5 text-2xl font-semibold text-ink-900">{deptStats.attendanceRate}%</p>
          </Card>
          <Card>
            <p className="text-[13px] text-ink-500">Present</p>
            <p className="mt-1.5 text-2xl font-semibold text-success-700">{deptStats.present}</p>
          </Card>
          <Card>
            <p className="text-[13px] text-ink-500">Late</p>
            <p className="mt-1.5 text-2xl font-semibold text-warning-700">{deptStats.late}</p>
          </Card>
          <Card>
            <p className="text-[13px] text-ink-500">Unmarked</p>
            <p className="mt-1.5 text-2xl font-semibold text-ink-900">{deptStats.unmarked}</p>
          </Card>
        </div>
      ) : null}

      <TableContainer>
        {attLoading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : attendanceRecords.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No attendance records"
            message="No attendance records for the selected date."
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Employee</TH>
                <TH>Check In</TH>
                <TH>Check Out</TH>
                <TH>Working Hours</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody>
              {attendanceRecords.map((record) => (
                <TR key={record.id}>
                  <TD>
                    <span className="flex items-center gap-3">
                      <Avatar name={record.employeeName} size="sm" />
                      <span className="font-medium text-ink-900">{record.employeeName}</span>
                    </span>
                  </TD>
                  <TD>{record.checkInTime || '—'}</TD>
                  <TD>{record.checkOutTime || '—'}</TD>
                  <TD>{record.workingHours}</TD>
                  <TD>
                    <StatusBadge status={record.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </TableContainer>
    </div>
  );
}
