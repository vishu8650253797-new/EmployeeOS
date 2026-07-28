import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
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
const ComingSoon = lazy(() => import('./pages/misc/ComingSoon'));
const NotFound = lazy(() => import('./pages/misc/NotFound'));

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
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

                  <Route path="/tasks" element={<ComingSoon title="Tasks" />} />
                  <Route path="/performance" element={<ComingSoon title="Performance" />} />
                  <Route path="/documents" element={<ComingSoon title="Documents" />} />
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
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
