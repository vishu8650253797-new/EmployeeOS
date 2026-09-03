import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarCheck,
  CalendarOff,
  CalendarPlus,
  Layers,
  ClipboardList,
  TrendingUp,
  FolderOpen,
  Wallet,
  BarChart3,
  LifeBuoy,
  Settings,
  FolderKanban,
  Gauge,
  Target,
  Award,
  MessageSquare,
  History,
  BarChart2,
  Briefcase,
  UserCheck,
  Kanban,
  Calendar,
  Send,
  Package,
  Truck,
  Wrench,
  LogOut,
} from 'lucide-react';

// Sidebar navigation. Later, filter sections/items by role permissions.

export const NAV_SECTIONS = [
  {
    title: 'Workspace',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      { label: 'Employees', to: '/employees', icon: Users },
      { label: 'Departments', to: '/departments', icon: Building2 },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Attendance', to: '/attendance', icon: CalendarCheck },
      { label: 'Leave', to: '/leave', icon: CalendarOff },
      { label: 'My Leave', to: '/my-leave', icon: CalendarPlus },
      { label: 'Leave Types', to: '/leave-types', icon: Layers },
      { label: 'Projects', to: '/projects', icon: FolderKanban },
      { label: 'Workload', to: '/workload', icon: Gauge },
      { label: 'Tasks', to: '/tasks', icon: ClipboardList },
      { label: 'Performance', to: '/performance', icon: TrendingUp },
      { label: 'Cycles', to: '/performance/cycles', icon: Award },
      { label: 'Goals', to: '/performance/goals', icon: Target },
      { label: 'KPIs', to: '/performance/kpis', icon: BarChart2 },
      { label: 'Reviews', to: '/performance/reviews', icon: ClipboardList },
      { label: 'Feedback', to: '/performance/feedback', icon: MessageSquare },
      { label: 'History', to: '/performance/history', icon: History },
    ],
  },
  {
    title: 'Resources',
    items: [
      { label: 'Documents', to: '/documents', icon: FolderOpen },
      { label: 'Payroll', to: '/payroll', icon: Wallet },
      { label: 'Reports', to: '/reports', icon: BarChart3 },
    ],
  },
  {
    title: 'Assets',
    items: [
      { label: 'Inventory', to: '/assets', icon: Package },
      { label: 'Categories', to: '/assets/categories', icon: Layers },
      { label: 'Vendors', to: '/assets/vendors', icon: Truck },
      { label: 'Requests', to: '/assets/requests', icon: ClipboardList },
      { label: 'Maintenance', to: '/assets/maintenance', icon: Wrench },
      { label: 'Analytics', to: '/assets/analytics', icon: BarChart2 },
    ],
  },
  {
    title: 'Offboarding',
    items: [
      { label: 'Offboarding', to: '/offboarding', icon: LogOut },
    ],
  },
  {
    title: 'Recruitment',
    items: [
      { label: 'Recruitment', to: '/recruitment', icon: Briefcase },
      { label: 'Jobs', to: '/recruitment/jobs', icon: Briefcase },
      { label: 'Candidates', to: '/recruitment/candidates', icon: UserCheck },
      { label: 'Pipeline', to: '/recruitment/pipeline', icon: Kanban },
      { label: 'Interviews', to: '/recruitment/interviews', icon: Calendar },
      { label: 'Offers', to: '/recruitment/offers', icon: Send },
      { label: 'Analytics', to: '/recruitment/analytics', icon: BarChart2 },
    ],
  },
];

export const NAV_FOOTER_ITEMS = [
  { label: 'Help & Support', to: '/support', icon: LifeBuoy },
  { label: 'Settings', to: '/settings', icon: Settings },
];
