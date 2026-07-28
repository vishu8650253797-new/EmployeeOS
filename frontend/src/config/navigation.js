import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarCheck,
  CalendarOff,
  ClipboardList,
  TrendingUp,
  FolderOpen,
  Wallet,
  BarChart3,
  LifeBuoy,
  Settings,
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
      { label: 'Tasks', to: '/tasks', icon: ClipboardList },
      { label: 'Performance', to: '/performance', icon: TrendingUp },
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
];

export const NAV_FOOTER_ITEMS = [
  { label: 'Help & Support', to: '/support', icon: LifeBuoy },
  { label: 'Settings', to: '/settings', icon: Settings },
];
