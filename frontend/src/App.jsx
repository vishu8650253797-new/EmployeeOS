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
const DocumentRequests = lazy(() => import('./pages/documents/DocumentRequests'));
const DocumentVersions = lazy(() => import('./pages/documents/DocumentVersions'));
const DocumentVerification = lazy(() => import('./pages/documents/DocumentVerification'));
const EmployeeDocumentDashboard = lazy(() => import('./pages/documents/EmployeeDocumentDashboard'));
const HRDocumentDashboard = lazy(() => import('./pages/documents/HRDocumentDashboard'));
const DocumentAnalytics = lazy(() => import('./pages/documents/DocumentAnalytics'));

// Asset management pages
const AssetInventory = lazy(() => import('./pages/assets/AssetInventory'));
const AssetForm = lazy(() => import('./pages/assets/AssetForm'));
const AssetDetails = lazy(() => import('./pages/assets/AssetDetails'));
const AssetCategories = lazy(() => import('./pages/assets/AssetCategories'));
const AssetVendors = lazy(() => import('./pages/assets/AssetVendors'));
const AssetVendorDetails = lazy(() => import('./pages/assets/AssetVendorDetails'));
const AssetRequests = lazy(() => import('./pages/assets/AssetRequests'));
const AssetMaintenance = lazy(() => import('./pages/assets/AssetMaintenance'));
const AssetAnalytics = lazy(() => import('./pages/assets/AssetAnalytics'));

// Offboarding pages
const OffboardingList = lazy(() => import('./pages/offboarding/OffboardingList'));
const OffboardingDetails = lazy(() => import('./pages/offboarding/OffboardingDetails'));

// Recruitment pages
const RecruitmentDashboard = lazy(() => import('./pages/recruitment/RecruitmentDashboard'));
const JobList = lazy(() => import('./pages/recruitment/JobList'));
const JobForm = lazy(() => import('./pages/recruitment/JobForm'));
const CandidateList = lazy(() => import('./pages/recruitment/CandidateList'));
const CandidateDetail = lazy(() => import('./pages/recruitment/CandidateDetail'));
const CandidateForm = lazy(() => import('./pages/recruitment/CandidateForm'));
const CandidatePipeline = lazy(() => import('./pages/recruitment/CandidatePipeline'));
const InterviewList = lazy(() => import('./pages/recruitment/InterviewList'));
const InterviewDetail = lazy(() => import('./pages/recruitment/InterviewDetail'));
const InterviewForm = lazy(() => import('./pages/recruitment/InterviewForm'));
const OfferList = lazy(() => import('./pages/recruitment/OfferList'));
const OfferDetail = lazy(() => import('./pages/recruitment/OfferDetail'));
const OfferForm = lazy(() => import('./pages/recruitment/OfferForm'));
const RecruitmentAnalytics = lazy(() => import('./pages/recruitment/RecruitmentAnalytics'));

// Public careers pages
const CareersPage = lazy(() => import('./pages/careers/CareersPage'));
const JobDetailsPage = lazy(() => import('./pages/careers/JobDetailsPage'));
const ApplicationFormPage = lazy(() => import('./pages/careers/ApplicationFormPage'));
const ApplicationSuccessPage = lazy(() => import('./pages/careers/ApplicationSuccessPage'));
const OfferResponsePage = lazy(() => import('./pages/careers/OfferResponsePage'));

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

              {/* Public careers routes */}
              <Route path="/careers" element={<CareersPage />} />
              <Route path="/careers/jobs/:slug" element={<JobDetailsPage />} />
              <Route path="/careers/jobs/:slug/apply" element={<ApplicationFormPage />} />
              <Route path="/careers/success" element={<ApplicationSuccessPage />} />
              <Route path="/careers/offer/:token" element={<OfferResponsePage />} />

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
                  <Route path="/documents/requests" element={<DocumentRequests />} />
                  <Route path="/documents/requests/:id" element={<DocumentRequests />} />
                  <Route path="/documents/requests/:id/upload" element={<DocumentUpload />} />
                  <Route path="/documents/:id" element={<Documents />} />
                  <Route path="/documents/:id/versions" element={<DocumentVersions />} />
                  <Route path="/documents/:id/verify" element={<DocumentVerification />} />
                  <Route path="/my-documents" element={<EmployeeDocumentDashboard />} />
                  <Route path="/hr/documents" element={<HRDocumentDashboard />} />
                  <Route path="/documents/analytics" element={<DocumentAnalytics />} />

                  <Route path="/assets" element={<AssetInventory />} />
                  <Route path="/assets/new" element={<AssetForm />} />
                  <Route path="/assets/categories" element={<AssetCategories />} />
                  <Route path="/assets/vendors" element={<AssetVendors />} />
                  <Route path="/assets/vendors/:id" element={<AssetVendorDetails />} />
                  <Route path="/assets/requests" element={<AssetRequests />} />
                  <Route path="/assets/maintenance" element={<AssetMaintenance />} />
                  <Route path="/assets/analytics" element={<AssetAnalytics />} />
                  <Route path="/assets/:id" element={<AssetDetails />} />
                  <Route path="/assets/:id/edit" element={<AssetForm />} />

                  <Route path="/offboarding" element={<OffboardingList />} />
                  <Route path="/offboarding/:id" element={<OffboardingDetails />} />

                  <Route path="/recruitment" element={<RecruitmentDashboard />} />
                  <Route path="/recruitment/jobs" element={<JobList />} />
                  <Route path="/recruitment/jobs/new" element={<JobForm />} />
                  <Route path="/recruitment/jobs/:id" element={<JobForm />} />
                  <Route path="/recruitment/jobs/:id/edit" element={<JobForm />} />
                  <Route path="/recruitment/candidates" element={<CandidateList />} />
                  <Route path="/recruitment/candidates/new" element={<CandidateForm />} />
                  <Route path="/recruitment/candidates/:id" element={<CandidateDetail />} />
                  <Route path="/recruitment/candidates/:id/edit" element={<CandidateForm />} />
                  <Route path="/recruitment/pipeline" element={<CandidatePipeline />} />
                  <Route path="/recruitment/interviews" element={<InterviewList />} />
                  <Route path="/recruitment/interviews/new" element={<InterviewForm />} />
                  <Route path="/recruitment/interviews/:id" element={<InterviewDetail />} />
                  <Route path="/recruitment/interviews/:id/edit" element={<InterviewForm />} />
                  <Route path="/recruitment/offers" element={<OfferList />} />
                  <Route path="/recruitment/offers/new" element={<OfferForm />} />
                  <Route path="/recruitment/offers/:id" element={<OfferDetail />} />
                  <Route path="/recruitment/offers/:id/edit" element={<OfferForm />} />
                  <Route path="/recruitment/analytics" element={<RecruitmentAnalytics />} />

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
