import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Mail,
  Phone,
  MapPin,
  Building2,
  Calendar,
  UserRound,
  Pencil,
  Trash2,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarOff,
  ClipboardList,
  FolderOpen,
  TrendingUp,
  LayoutGrid,
  Package,
} from 'lucide-react';
import { employeeService } from '../../services/employeeService';
import { attendanceService } from '../../services/attendanceService';
import { assetService } from '../../services/assetService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { formatDate, fullName, formatAddress, roleLabel } from '../../utils/format';
import { ROLES } from '../../config/roles';
import PageHeader from '../../components/layout/PageHeader';
import Card, { CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';

const TABS = [
  { value: 'overview', label: 'Overview', icon: LayoutGrid },
  { value: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { value: 'leave', label: 'Leave', icon: CalendarOff },
  { value: 'assets', label: 'Assets', icon: Package },
  { value: 'tasks', label: 'Tasks', icon: ClipboardList },
  { value: 'documents', label: 'Documents', icon: FolderOpen },
  { value: 'performance', label: 'Performance', icon: TrendingUp },
];

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-ink-400">{label}</p>
        <p className="mt-0.5 break-words text-[13px] font-medium text-ink-900">{value || '—'}</p>
      </div>
    </div>
  );
}

function OverviewTab({ employee }) {
  const emergency = employee.emergencyContact;
  const emergencyValue = emergency?.name
    ? `${emergency.name} (${emergency.relationship || '—'}) · ${emergency.phone || '—'}`
    : '—';

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Personal information" />
        <div className="mt-2 divide-y divide-line">
          <InfoRow icon={UserRound} label="Full name" value={fullName(employee)} />
          <InfoRow icon={Calendar} label="Date of birth" value={formatDate(employee.dateOfBirth)} />
          <InfoRow icon={UserRound} label="Gender" value={employee.gender} />
          <InfoRow icon={MapPin} label="Address" value={formatAddress(employee.address)} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Contact information" />
        <div className="mt-2 divide-y divide-line">
          <InfoRow icon={Mail} label="Work email" value={employee.email} />
          <InfoRow icon={Phone} label="Phone" value={employee.phone} />
          <InfoRow icon={MapPin} label="Location" value={employee.location} />
          <InfoRow icon={Phone} label="Emergency contact" value={emergencyValue} />
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Employment information" />
        <div className="mt-2 grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          <InfoRow icon={Building2} label="Department" value={employee.department} />
          <InfoRow icon={BriefcaseBusiness} label="Job title" value={employee.jobTitle} />
          <InfoRow icon={UserRound} label="Reporting manager" value={employee.manager} />
          <InfoRow icon={Calendar} label="Joining date" value={formatDate(employee.joiningDate)} />
          <InfoRow icon={BriefcaseBusiness} label="Employment type" value={employee.employmentType?.replace('_', '-')} />
          <InfoRow icon={UserRound} label="Role" value={roleLabel(employee.role, ROLES)} />
        </div>
      </Card>
    </div>
  );
}

function AttendanceTab({ employee }) {
  const [page, setPage] = useState(1);
  const { data: summary, loading: summaryLoading } = useFetch(
    () => attendanceService.getEmployeeSummary(employee.id),
    [employee.id]
  );
  const { data: historyResponse, loading: historyLoading } = useFetch(
    () => attendanceService.getEmployeeAttendance(employee.id, { page, limit: 10 }),
    [employee.id, page]
  );

  const historyRecords = historyResponse?.records || [];
  const pagination = historyResponse?.pagination || { page: 1, totalPages: 1 };

  const cells = summary
    ? [
        { label: 'Days present', value: summary.present, tone: 'text-success-700' },
        { label: 'Days absent', value: summary.absent, tone: 'text-danger-700' },
        { label: 'Late arrivals', value: summary.late, tone: 'text-warning-700' },
        { label: 'On leave', value: summary.onLeave, tone: 'text-info-700' },
      ]
    : [];

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summaryLoading
          ? Array.from({ length: 4 }).map((_, i) => <Card key={i}><p className="text-[13px] text-ink-500">Loading…</p></Card>)
          : cells.map((cell) => (
              <Card key={cell.label}>
                <p className="text-[13px] text-ink-500">{cell.label}</p>
                <p className={`mt-1.5 text-2xl font-semibold tracking-tight ${cell.tone}`}>{cell.value}</p>
              </Card>
            ))}
      </div>
      <Card className="mt-4">
        <CardHeader title="Attendance rate" subtitle="Recorded days" />
        <div className="mt-4 flex items-center gap-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
            <div className="h-full rounded-full bg-success-600" style={{ width: `${summary?.attendanceRate || 0}%` }} />
          </div>
          <span className="text-lg font-semibold text-ink-900">{summary?.attendanceRate || 0}%</span>
        </div>
      </Card>
      <Card className="mt-4" padding={false}>
        <CardHeader title="Recent attendance" className="px-5 pt-5" />
        <div className="px-5 pb-3">
          {historyLoading ? (
            <p className="py-4 text-[13px] text-ink-500">Loading attendance history…</p>
          ) : historyRecords.length === 0 ? (
            <p className="py-4 text-[13px] text-ink-500">No attendance records found.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {historyRecords.map((record) => (
                <li key={record.id} className="flex items-center justify-between py-3 text-[13px]">
                  <span className="text-ink-500">{formatDate(record.date)}</span>
                  <span className="font-medium text-ink-900">{record.workingHours}</span>
                  <StatusBadge status={record.status} />
                </li>
              ))}
            </ul>
          )}
          {pagination.totalPages > 1 && (
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}>Next</Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function LeaveTab({ employee }) {
  const balance = employee.leaveBalance || { casual: 0, sick: 0, earned: 0 };
  const balances = [
    { label: 'Casual Leave', value: balance.casual },
    { label: 'Sick Leave', value: balance.sick },
    { label: 'Earned Leave', value: balance.earned },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {balances.map((b) => (
          <Card key={b.label}>
            <p className="text-[13px] text-ink-500">{b.label}</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-900">
              {b.value}
              <span className="ml-1 text-sm font-normal text-ink-400">days left</span>
            </p>
          </Card>
        ))}
      </div>
      <Card padding={false} className="mt-4">
        <CardHeader title="Leave history" className="px-5 pt-5" />
        <EmptyState icon={CalendarOff} title="No leave requests" message="This employee has not requested any leave yet." />
      </Card>
    </div>
  );
}

function AssetsTab({ employee }) {
  const navigate = useNavigate();
  const { data: assets, loading, error, refetch } = useFetch(
    () => assetService.getEmployeeAssets(employee.id),
    [employee.id]
  );

  if (loading) return <CardSkeleton lines={4} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <Card padding={false}>
      <CardHeader title="Assigned assets" subtitle={`${assets.length} asset(s)`} className="px-5 pt-5" />
      {assets.length === 0 ? (
        <EmptyState icon={Package} title="No assigned assets" message="Assets assigned to this employee will appear here." />
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {assets.map((asset) => (
            <li key={asset.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <button
                type="button"
                onClick={() => navigate(`/assets/${asset.id}`)}
                className="focus-ring rounded-lg text-left"
              >
                <span className="block text-[13px] font-medium text-ink-900 hover:text-brand-700">{asset.name}</span>
                <span className="block text-xs text-ink-400">
                  {asset.assetTag} · {asset.categoryId?.name}
                </span>
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-500">Assigned {formatDate(asset.assignedAt)}</span>
                <StatusBadge status={asset.condition} />
                <StatusBadge status={asset.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PlaceholderTab({ icon, title, message }) {
  return (
    <Card padding={false}>
      <EmptyState icon={icon} title={title} message={message} />
    </Card>
  );
}

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: employee, loading, error, refetch } = useFetch(
    () => employeeService.getEmployeeById(id),
    [id]
  );

  async function handleDelete() {
    setDeleting(true);
    try {
      await employeeService.deleteEmployee(id);
      toast(`${fullName(employee)} has been removed.`);
      navigate('/employees');
    } catch (err) {
      toast(err.message || 'Failed to delete employee. Please try again.', 'error');
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton lines={4} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={5} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Employee not found"
        message="This employee may have been removed or the link is incorrect."
        onRetry={refetch}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Employee Profile"
        breadcrumbs={[
          { label: 'Employees', to: '/employees' },
          { label: fullName(employee) },
        ]}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(`/employees/${id}/edit`)}>
              <Pencil size={14} />
              Edit
            </Button>
            <Button variant="dangerGhost" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} />
              Delete
            </Button>
          </>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={fullName(employee)} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-ink-900">{fullName(employee)}</h2>
              <StatusBadge status={employee.status} />
            </div>
            <p className="mt-0.5 text-[13px] text-ink-500">
              {employee.jobTitle} · {employee.department}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-500">
              <span className="flex items-center gap-1.5">
                <Mail size={13} className="text-ink-400" /> {employee.email}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={13} className="text-ink-400" /> {employee.location || '—'}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 gap-6 sm:text-right">
            <div>
              <p className="text-xs text-ink-400">Employee ID</p>
              <p className="mt-0.5 text-[13px] font-medium text-ink-900">{employee.employeeId}</p>
            </div>
            <div>
              <p className="text-xs text-ink-400">Joined</p>
              <p className="mt-0.5 text-[13px] font-medium text-ink-900">{formatDate(employee.joiningDate)}</p>
            </div>
          </div>
        </div>
      </Card>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} className="mb-5" />

      {activeTab === 'overview' && <OverviewTab employee={employee} />}
      {activeTab === 'attendance' && <AttendanceTab employee={employee} />}
      {activeTab === 'leave' && <LeaveTab employee={employee} />}
      {activeTab === 'assets' && <AssetsTab employee={employee} />}
      {activeTab === 'tasks' && (
        <PlaceholderTab
          icon={ClipboardList}
          title="No tasks assigned"
          message="Task management will be available once the Tasks module is connected."
        />
      )}
      {activeTab === 'documents' && (
        <PlaceholderTab
          icon={FolderOpen}
          title="No documents uploaded"
          message="Employee documents such as contracts and ID proofs will appear here."
        />
      )}
      {activeTab === 'performance' && (
        <PlaceholderTab
          icon={TrendingUp}
          title="No performance reviews yet"
          message="Performance reviews and goals will appear here after the first review cycle."
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete employee"
        message={`Are you sure you want to delete ${fullName(employee)} (${employee.employeeId})? This action cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
