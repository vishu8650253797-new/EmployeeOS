// Mock dashboard data — replace with API data via a dashboard/analytics service later.

export const DASHBOARD_STATS = {
  totalEmployees: 18,
  presentToday: 11,
  onLeave: 1,
  absent: 2,
  pendingLeaveRequests: 5,
  newEmployeesThisMonth: 2,
  attendanceRate: 88.2,
  employeeGrowth: 12.5,
};

export const EMPLOYEE_GROWTH = [
  { month: 'Aug', count: 9 },
  { month: 'Sep', count: 10 },
  { month: 'Oct', count: 11 },
  { month: 'Nov', count: 11 },
  { month: 'Dec', count: 12 },
  { month: 'Jan', count: 13 },
  { month: 'Feb', count: 14 },
  { month: 'Mar', count: 14 },
  { month: 'Apr', count: 15 },
  { month: 'May', count: 16 },
  { month: 'Jun', count: 17 },
  { month: 'Jul', count: 18 },
];

export const ATTENDANCE_OVERVIEW = [
  { day: 'Mon', present: 15, absent: 1, late: 1, onLeave: 1 },
  { day: 'Tue', present: 14, absent: 2, late: 1, onLeave: 1 },
  { day: 'Wed', present: 16, absent: 0, late: 1, onLeave: 1 },
  { day: 'Thu', present: 13, absent: 2, late: 2, onLeave: 1 },
  { day: 'Fri', present: 14, absent: 1, late: 2, onLeave: 1 },
  { day: 'Sat', present: 6, absent: 0, late: 0, onLeave: 0 },
  { day: 'Sun', present: 0, absent: 0, late: 0, onLeave: 0 },
];

export const LEAVE_STATS = [
  { label: 'Pending', count: 5, color: 'bg-warning-600' },
  { label: 'Approved', count: 4, color: 'bg-success-600' },
  { label: 'Rejected', count: 2, color: 'bg-danger-600' },
];

export const DEPARTMENT_DISTRIBUTION = [
  { name: 'Engineering', count: 5, color: 'bg-brand-500' },
  { name: 'Sales', count: 3, color: 'bg-info-600' },
  { name: 'Design', count: 3, color: 'bg-success-600' },
  { name: 'Human Resources', count: 2, color: 'bg-warning-600' },
  { name: 'Finance', count: 2, color: 'bg-brand-300' },
  { name: 'IT & Operations', count: 2, color: 'bg-ink-400' },
  { name: 'Marketing', count: 2, color: 'bg-danger-600' },
];

export const RECENT_ACTIVITIES = [
  { id: 'act-001', type: 'leave', message: 'Sneha Patil applied for 2 days of Casual Leave', time: '25 minutes ago' },
  { id: 'act-002', type: 'employee', message: 'Nikhil Chawla joined as Sales Development Rep', time: '2 hours ago' },
  { id: 'act-003', type: 'attendance', message: 'Rahul Joshi checked in late at 9:55 AM', time: '4 hours ago' },
  { id: 'act-004', type: 'leave', message: 'Divya Krishnan approved Arjun Reddy\'s leave request', time: 'Yesterday' },
  { id: 'act-005', type: 'department', message: 'Marketing department headcount updated to 2', time: 'Yesterday' },
  { id: 'act-006', type: 'employee', message: 'Kavya Rao completed onboarding checklist', time: '2 days ago' },
];

export const UPCOMING_EVENTS = [
  { id: 'evt-001', title: 'Quarterly All-Hands', date: '2026-08-01', time: '10:00 AM', type: 'Company' },
  { id: 'evt-002', title: 'Engineering Sprint Review', date: '2026-07-31', time: '3:00 PM', type: 'Team' },
  { id: 'evt-003', title: 'Tanvi Desai — Work Anniversary', date: '2026-08-05', time: 'All day', type: 'Celebration' },
  { id: 'evt-004', title: 'Payroll Processing Cut-off', date: '2026-08-08', time: '6:00 PM', type: 'Finance' },
  { id: 'evt-005', title: 'New Hire Orientation Batch', date: '2026-08-11', time: '9:30 AM', type: 'HR' },
];

export const PENDING_APPROVALS = [
  { id: 'ap-001', type: 'Leave Request', requester: 'Sneha Patil', detail: 'Casual Leave · Aug 3–4', link: '/leave' },
  { id: 'ap-002', type: 'Leave Request', requester: 'Aarav Sharma', detail: 'Earned Leave · Aug 10–14', link: '/leave' },
  { id: 'ap-003', type: 'Leave Request', requester: 'Rahul Joshi', detail: 'Casual Leave · Aug 1', link: '/leave' },
  { id: 'ap-004', type: 'Leave Request', requester: 'Tanvi Desai', detail: 'Work From Home · Aug 5–7', link: '/leave' },
  { id: 'ap-005', type: 'Leave Request', requester: 'Ishaan Bose', detail: 'Earned Leave · Aug 17–21', link: '/leave' },
];

export const NOTIFICATIONS = [
  { id: 'ntf-001', title: 'Leave request pending', message: 'Sneha Patil applied for Casual Leave (Aug 3–4).', time: '25m ago', read: false },
  { id: 'ntf-002', title: 'New employee onboarded', message: 'Nikhil Chawla joined the Sales team today.', time: '2h ago', read: false },
  { id: 'ntf-003', title: 'Attendance alert', message: '2 employees are absent without notice today.', time: '4h ago', read: false },
  { id: 'ntf-004', title: 'Payroll reminder', message: 'August payroll cut-off is on Aug 8, 6:00 PM.', time: '1d ago', read: true },
  { id: 'ntf-005', title: 'Document expiring', message: 'Aditya Singh\'s ID proof expires in 30 days.', time: '2d ago', read: true },
];
