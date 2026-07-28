import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  CalendarOff,
  UserX,
  Clock,
  UserPlus,
  Percent,
  ArrowUpRight,
  CalendarDays,
  CalendarCheck,
  ChevronRight,
  Building2,
} from 'lucide-react';
import {
  DASHBOARD_STATS,
  EMPLOYEE_GROWTH,
  ATTENDANCE_OVERVIEW,
  LEAVE_STATS,
  DEPARTMENT_DISTRIBUTION,
  RECENT_ACTIVITIES,
  UPCOMING_EVENTS,
  PENDING_APPROVALS,
} from '../../data/dashboard';
import { dashboardService } from '../../services/dashboardService';
import { attendanceService } from '../../services/attendanceService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Card, { CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import { StatCardSkeleton } from '../../components/ui/Skeleton';

function TodayAttendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const { data, loading, refetch } = useFetch(() => attendanceService.getToday(), []);

  if (loading) return <StatCardSkeleton />;

  const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user?.role);

  if (isAdmin) {
    const stats = data || {};
    return (
      <Card className="flex flex-col justify-between sm:flex-row sm:items-center">
        <div>
          <p className="text-[13px] font-medium text-ink-500">Today&apos;s attendance</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">{stats.date || '—'}</p>
          <p className="mt-1 text-[13px] text-ink-500">
            {stats.present || 0} present · {stats.late || 0} late · {stats.absent || 0} absent · {stats.totalEmployees || 0} total
          </p>
        </div>
        <Link to="/attendance" className="mt-3 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-brand-600 hover:text-brand-700 sm:mt-0">
          View all <ArrowUpRight size={14} />
        </Link>
      </Card>
    );
  }

  const record = data || {};

  async function handleCheckIn() {
    setProcessing(true);
    try {
      await attendanceService.checkIn();
      toast('Checked in successfully');
      await refetch();
    } catch (err) {
      toast(err.message || 'Check-in failed', 'error');
    } finally {
      setProcessing(false);
    }
  }

  async function handleCheckOut() {
    setProcessing(true);
    try {
      await attendanceService.checkOut();
      toast('Checked out successfully');
      await refetch();
    } catch (err) {
      toast(err.message || 'Check-out failed', 'error');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Card className="flex flex-col justify-between sm:flex-row sm:items-center">
      <div>
        <p className="text-[13px] font-medium text-ink-500">Your attendance today</p>
        {record.checkedIn ? (
          <div className="mt-1 space-y-1">
            <p className="text-2xl font-semibold tracking-tight text-ink-900">{record.checkInTime}</p>
            <p className="text-[13px] text-ink-500">
              {record.workingHours || '0h 0m'} · <StatusBadge status={record.status || 'PRESENT'} />
            </p>
          </div>
        ) : (
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">Not checked in</p>
        )}
      </div>
      <div className="mt-3 flex gap-2 sm:mt-0">
        {!record.checkedIn && (
          <Button onClick={handleCheckIn} loading={processing}>
            <CalendarCheck size={14} /> Check In
          </Button>
        )}
        {record.checkedIn && !record.checkedOut && (
          <Button onClick={handleCheckOut} loading={processing}>
            <Clock size={14} /> Check Out
          </Button>
        )}
      </div>
    </Card>
  );
}

function GrowthChart() {
  const max = Math.max(...EMPLOYEE_GROWTH.map((d) => d.count));
  const points = EMPLOYEE_GROWTH.map((d, i) => {
    const x = (i / (EMPLOYEE_GROWTH.length - 1)) * 100;
    const y = 100 - (d.count / max) * 82 - 8;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-44 w-full" aria-hidden="true">
        <polygon points={`0,100 ${points} 100,100`} fill="url(#growthFill)" />
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink-400">
        {EMPLOYEE_GROWTH.filter((_, i) => i % 2 === 0).map((d) => (
          <span key={d.month}>{d.month}</span>
        ))}
      </div>
    </div>
  );
}

function classToChartColor(tone) {
  const map = {
    'bg-warning-600': 'var(--color-warning-600)',
    'bg-success-600': 'var(--color-success-600)',
    'bg-danger-600': 'var(--color-danger-600)',
    'bg-brand-500': 'var(--color-brand-500)',
    'bg-info-600': 'var(--color-info-600)',
    'bg-brand-300': 'var(--color-brand-300)',
    'bg-ink-400': 'var(--color-ink-400)',
  };
  return map[tone] || 'var(--color-ink-400)';
}

function Donut3DChart({ title, subtitle, segments, total }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let rafId;
    const duration = 1000;
    const startTime = performance.now();

    const animate = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      setProgress(eased);
      if (t < 1) rafId = requestAnimationFrame(animate);
    };

    setProgress(0);
    rafId = requestAnimationFrame(animate);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [segments, total]);

  const safeTotal = Math.max(total, 1);
  const separator = segments.length > 1 ? 0.8 : 0;
  let cumulative = 0;
  const stops = [];

  segments.forEach((segment) => {
    const slice = (segment.count / safeTotal) * 100 * progress;
    const start = cumulative;
    const colorEnd = Math.max(start + slice - separator, start);
    const sliceEnd = start + slice;

    stops.push(`${classToChartColor(segment.color)} ${start}% ${colorEnd}%`);
    if (separator > 0) {
      stops.push(`var(--color-surface) ${colorEnd}% ${sliceEnd}%`);
    }

    cumulative = sliceEnd;
  });

  if (cumulative < 100) {
    stops.push(`var(--color-surface) ${cumulative}% 100%`);
  }

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="mt-4 border-t border-line pt-6">
        <div
          className="mx-auto relative h-72 w-72 rounded-full"
          style={{ backgroundImage: `conic-gradient(from -90deg, ${stops.join(', ')})` }}
          role="img"
          aria-label={`${title} circular chart`}
        >
          <div className="absolute inset-[36px] rounded-full bg-surface" aria-hidden="true" />
        </div>

        <ul className="mx-auto mt-8 grid max-w-xl grid-cols-1 gap-x-8 gap-y-3 text-center sm:grid-cols-2">
          {segments.map((segment) => {
            return (
              <li key={segment.label || segment.name} className="flex items-center justify-center gap-3 text-[13px]">
                <span className={`h-2.5 w-2.5 rounded-full ${segment.color}`} aria-hidden="true" />
                <span className="text-ink-700">
                  {segment.label || segment.name}
                </span>
                <span className="font-semibold text-ink-900">{segment.count}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

function AttendanceChart() {
  const max = Math.max(...ATTENDANCE_OVERVIEW.map((d) => d.present + d.absent + d.late + d.onLeave), 1);
  return (
    <div>
      <div className="flex h-44 items-end gap-2 sm:gap-3">
        {ATTENDANCE_OVERVIEW.map((day) => {
          const total = day.present + day.absent + day.late + day.onLeave;
          return (
            <div key={day.day} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className="flex w-full max-w-9 flex-col-reverse overflow-hidden rounded-md bg-canvas"
                style={{ height: `${Math.max((total / max) * 100, 2)}%` }}
                role="img"
                aria-label={`${day.day}: ${day.present} present, ${day.late} late, ${day.absent} absent, ${day.onLeave} on leave`}
              >
                <div className="w-full bg-brand-500" style={{ flexGrow: day.present }} />
                <div className="w-full bg-warning-600/80" style={{ flexGrow: day.late }} />
                <div className="w-full bg-danger-600/80" style={{ flexGrow: day.absent }} />
                <div className="w-full bg-info-600/70" style={{ flexGrow: day.onLeave }} />
              </div>
              <span className="text-[10px] text-ink-400">{day.day}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-ink-500">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-brand-500" /> Present</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-warning-600/80" /> Late</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-danger-600/80" /> Absent</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-info-600/70" /> On Leave</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [liveStats, setLiveStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const totalLeave = LEAVE_STATS.reduce((sum, s) => sum + s.count, 0);
  const totalDept = DEPARTMENT_DISTRIBUTION.reduce((sum, d) => sum + d.count, 0);

  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    dashboardService
      .getStats()
      .then((data) => {
        if (!cancelled) setLiveStats(data);
      })
      .catch(() => {})
      .finally(() => !cancelled && setStatsLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const totalEmployees = liveStats?.totalEmployees ?? DASHBOARD_STATS.totalEmployees;
  const activeEmployees = liveStats?.activeEmployees ?? DASHBOARD_STATS.presentToday;
  const inactiveEmployees = liveStats?.inactiveEmployees ?? DASHBOARD_STATS.absent;
  const onLeaveCount = liveStats?.onLeave ?? DASHBOARD_STATS.onLeave;
  const totalDepartments = liveStats?.totalDepartments ?? 0;

  const statCards = [
    { label: 'Total Employees', value: totalEmployees, icon: Users, tone: 'bg-brand-50 text-brand-600', trend: 'across organization' },
    { label: 'Active', value: activeEmployees, icon: UserCheck, tone: 'bg-success-50 text-success-600', trend: 'employees active' },
    { label: 'On Leave', value: onLeaveCount, icon: CalendarOff, tone: 'bg-info-50 text-info-600', trend: 'approved today' },
    { label: 'Inactive', value: inactiveEmployees, icon: UserX, tone: 'bg-danger-50 text-danger-600', trend: 'not active' },
    { label: 'Departments', value: totalDepartments, icon: Building2, tone: 'bg-brand-50 text-brand-600', trend: 'active departments' },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Overview for ${formatDate(new Date(), { weekday: 'long' })}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          statCards.map(({ label, value, icon: Icon, tone, trend }) => (
            <Card key={label} className="flex items-start justify-between">
              <div>
                <p className="text-[13px] font-medium text-ink-500">{label}</p>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-900">{value}</p>
                <p className="mt-1 text-xs text-ink-400">{trend}</p>
              </div>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                <Icon size={17} aria-hidden="true" />
              </span>
            </Card>
          ))
        )}
        <Card className="flex flex-col justify-between border-dashed">
          <p className="text-[13px] font-medium text-ink-500">Quick actions</p>
          <div className="mt-3 flex flex-col gap-2">
            <Link to="/employees/new" className="focus-ring inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-brand-600 hover:text-brand-700">
              <ArrowUpRight size={14} /> Add new employee
            </Link>
            <Link to="/leave" className="focus-ring inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-brand-600 hover:text-brand-700">
              <ArrowUpRight size={14} /> Review leave requests
            </Link>
            <Link to="/attendance" className="focus-ring inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-brand-600 hover:text-brand-700">
              <ArrowUpRight size={14} /> View today&apos;s attendance
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <TodayAttendance />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Employee growth" subtitle="Headcount over the last 12 months" />
          <div className="mt-4">
            <GrowthChart />
          </div>
        </Card>
        <Card>
          <CardHeader title="Attendance overview" subtitle="This week, all departments" />
          <div className="mt-4">
            <AttendanceChart />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Donut3DChart
          title="Leave statistics"
          subtitle="Requests this month"
          segments={LEAVE_STATS}
          total={totalLeave}
        />

        <Donut3DChart
          title="Department distribution"
          subtitle={`${totalDept} employees across ${DEPARTMENT_DISTRIBUTION.length} departments`}
          segments={DEPARTMENT_DISTRIBUTION}
          total={totalDept}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card padding={false}>
          <CardHeader title="Recent activities" className="px-5 pt-5" />
          <ul className="mt-2 divide-y divide-line px-5 pb-3">
            {RECENT_ACTIVITIES.map((activity) => (
              <li key={activity.id} className="flex gap-3 py-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                <div>
                  <p className="text-[13px] text-ink-700">{activity.message}</p>
                  <p className="mt-0.5 text-[11px] text-ink-400">{activity.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card padding={false}>
          <CardHeader title="Upcoming events" className="px-5 pt-5" />
          <ul className="mt-2 divide-y divide-line px-5 pb-3">
            {UPCOMING_EVENTS.map((event) => (
              <li key={event.id} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-500">
                  <CalendarDays size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink-900">{event.title}</p>
                  <p className="mt-0.5 text-[11px] text-ink-400">
                    {formatDate(event.date)} · {event.time}
                  </p>
                </div>
                <Badge tone="neutral" dot={false}>{event.type}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card padding={false}>
          <CardHeader
            title="Pending approvals"
            className="px-5 pt-5"
            action={
              <Link to="/leave" className="focus-ring rounded-md text-[13px] font-medium text-brand-600 hover:text-brand-700">
                View all
              </Link>
            }
          />
          <ul className="mt-2 divide-y divide-line px-5 pb-3">
            {PENDING_APPROVALS.map((approval) => (
              <li key={approval.id}>
                <Link
                  to={approval.link}
                  className="focus-ring -mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-canvas"
                >
                  <Avatar name={approval.requester} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink-900">{approval.requester}</p>
                    <p className="mt-0.5 truncate text-[11px] text-ink-400">{approval.detail}</p>
                  </div>
                  <ChevronRight size={15} className="shrink-0 text-ink-400" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
