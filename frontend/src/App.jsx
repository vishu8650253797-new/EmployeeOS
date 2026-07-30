import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { SocketProvider } from './context/SocketContext';
import AppLayout from './components/layout/AppLayout';
import AuthLayout from './components/layout/AuthLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { LoadingState } from './components/ui/States';

// Auth pages
const Login = lazy(() => import('./pages/auth/Login'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));

// App pages
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const EmployeeList = lazy(() => import('./pages/employees/EmployeeList'));
const EmployeeForm = lazy(() => import('./pages/employees/EmployeeForm'));
const EmployeeProfile = lazy(() => import('./pages/employees/EmployeeProfile'));
const DepartmentList = lazy(() => import('./pages/departments/DepartmentList'));
const DepartmentDetails = lazy(() => import('./pages/departments/DepartmentDetails'));
const Attendance = lazy(() => import('./pages/attendance/Attendance'));
const MyAttendance = lazy(() => import('./pages/attendance/MyAttendance'));
const Leave = lazy(() => import('./pages/leave/Leave'));
const MyLeave = lazy(() => import('./pages/leave/MyLeave'));
const LeaveTypes = lazy(() => import('./pages/leave/LeaveTypes'));
const Projects = lazy(() => import('./pages/projects/Projects'));
const ProjectDetails = lazy(() => import('./pages/projects/ProjectDetails'));
const KanbanBoard = lazy(() => import('./pages/projects/KanbanBoard'));
const TaskList = lazy(() => import('./pages/projects/TaskList'));
const TaskDetails = lazy(() => import('./pages/projects/TaskDetails'));
const Workload = lazy(() => import('./pages/workload/Workload'));
const Performance = lazy(() => import('./pages/performance/Performance'));
const PerformanceCycles = lazy(() => import('./pages/performance/PerformanceCycles'));
const Goals = lazy(() => import('./pages/performance/Goals'));
const KPIs = lazy(() => import('./pages/performance/KPIs'));
const PerformanceReviews = lazy(() => import('./pages/performance/PerformanceReviews'));
const Feedback = lazy(() => import('./pages/performance/Feedback'));
const PerformanceHistory = lazy(() => import('./pages/performance/PerformanceHistory'));
const PerformanceAnalytics = lazy(() => import('./pages/performance/PerformanceAnalytics'));
const Documents = lazy(() => import('./pages/documents/Documents'));
const DocumentUpload = lazy(() => import('./pages/documents/DocumentUpload'));
const ComingSoon = lazy(() => import('./pages/misc/ComingSoon'));
const NotFound = lazy(() => import('./pages/misc/NotFound'));

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <SocketProvider>
            <Suspense fallback={<LoadingState label="Loading EmployeeOS…" className="min-h-dvh" />}>
            <Routes>
              {/* Public auth routes */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
              </Route>

              {/* Protected app routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />

                  <Route path="/employees" element={<EmployeeList />} />
                  <Route path="/employees/new" element={<EmployeeForm />} />
                  <Route path="/employees/:id" element={<EmployeeProfile />} />
                  <Route path="/employees/:id/edit" element={<EmployeeForm />} />

                  <Route path="/departments" element={<DepartmentList />} />
                  <Route path="/departments/:id" element={<DepartmentDetails />} />

                  <Route path="/attendance" element={<Attendance />} />
                  <Route path="/my-attendance" element={<MyAttendance />} />
                  <Route path="/leave" element={<Leave />} />
                  <Route path="/my-leave" element={<MyLeave />} />
                  <Route path="/leave-types" element={<LeaveTypes />} />

                  <Route path="/projects" element={<Projects />} />
                  <Route path="/projects/:id" element={<ProjectDetails />} />
                  <Route path="/projects/:id/board" element={<KanbanBoard />} />
                  <Route path="/projects/:id/tasks" element={<TaskList />} />
                  <Route path="/projects/:id/tasks/new" element={<ComingSoon title="New Task" />} />
                  <Route path="/projects/:id/tasks/:taskId" element={<TaskDetails />} />
                  <Route path="/projects/:id/tasks/:taskId/edit" element={<ComingSoon title="Edit Task" />} />
                  <Route path="/workload" element={<Workload />} />

                  <Route path="/performance" element={<Performance />} />
                  <Route path="/performance/cycles" element={<PerformanceCycles />} />
                  <Route path="/performance/goals" element={<Goals />} />
                  <Route path="/performance/kpis" element={<KPIs />} />
                  <Route path="/performance/reviews" element={<PerformanceReviews />} />
                  <Route path="/performance/feedback" element={<Feedback />} />
                  <Route path="/performance/history" element={<PerformanceHistory />} />
                  <Route path="/performance/analytics" element={<PerformanceAnalytics />} />

                  <Route path="/documents" element={<Documents />} />
                  <Route path="/documents/upload" element={<DocumentUpload />} />

                  <Route path="/tasks" element={<ComingSoon title="Tasks" />} />
                  <Route path="/payroll" element={<ComingSoon title="Payroll" />} />
                  <Route path="/reports" element={<ComingSoon title="Reports" />} />
                  <Route path="/settings" element={<ComingSoon title="Settings" />} />
                  <Route path="/support" element={<ComingSoon title="Help & Support" />} />
                </Route>
              </Route>

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </SocketProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
