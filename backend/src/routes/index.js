const { Router } = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const essRoutes = require('./essRoutes');
const employeeRoutes = require('./employeeRoutes');
const departmentRoutes = require('./departmentRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const leaveTypeRoutes = require('./leaveTypeRoutes');
const leaveBalanceRoutes = require('./leaveBalanceRoutes');
const leaveRequestRoutes = require('./leaveRequestRoutes');
const notificationRoutes = require('./notificationRoutes');
const projectRoutes = require('./projectRoutes');
const taskRoutes = require('./taskRoutes');
const taskCommentRoutes = require('./taskCommentRoutes');
const workloadRoutes = require('./workloadRoutes');
const performanceCycleRoutes = require('./performanceCycleRoutes');
const goalRoutes = require('./goalRoutes');
const kpiRoutes = require('./kpiRoutes');
const performanceReviewRoutes = require('./performanceReviewRoutes');
const feedbackRoutes = require('./feedbackRoutes');
const performanceAnalyticsRoutes = require('./performanceAnalyticsRoutes');
const documentRoutes = require('./documentRoutes');
const documentCategoryRoutes = require('./documentCategoryRoutes');
const documentRequestRoutes = require('./documentRequestRoutes');
const documentAnalyticsRoutes = require('./documentAnalyticsRoutes');
const recruitmentRoutes = require('./recruitmentRoutes');
const publicJobRoutes = require('./publicJobRoutes');
const onboardingTemplateRoutes = require('./onboardingTemplateRoutes');
const onboardingRoutes = require('./onboardingRoutes');
const offboardingRoutes = require('./offboardingRoutes');
const assetCategoryRoutes = require('./assetCategoryRoutes');
const assetVendorRoutes = require('./assetVendorRoutes');
const assetRequestRoutes = require('./assetRequestRoutes');
const assetMaintenanceRoutes = require('./assetMaintenanceRoutes');
const assetAnalyticsRoutes = require('./assetAnalyticsRoutes');
const assetRoutes = require('./assetRoutes');
const salaryComponentRoutes = require('./salaryComponentRoutes');
const salaryStructureRoutes = require('./salaryStructureRoutes');
const employeeCompensationRoutes = require('./employeeCompensationRoutes');
const payrollPeriodRoutes = require('./payrollPeriodRoutes');
const payrollRunRoutes = require('./payrollRunRoutes');
const payslipRoutes = require('./payslipRoutes');
const payrollAnalyticsRoutes = require('./payrollAnalyticsRoutes');

const router = Router();

router.get('/health', (req, res) => {
  res.json({ success: true, service: 'EmployeeOS API', status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/ess', essRoutes);
router.use('/users', userRoutes);
router.use('/employees', employeeRoutes);
router.use('/departments', departmentRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leave-types', leaveTypeRoutes);
router.use('/leave-balances', leaveBalanceRoutes);
router.use('/leave-requests', leaveRequestRoutes);
router.use('/notifications', notificationRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/comments', taskCommentRoutes);
router.use('/workload', workloadRoutes);
router.use('/performance-cycles', performanceCycleRoutes);
router.use('/goals', goalRoutes);
router.use('/kpis', kpiRoutes);
router.use('/performance-reviews', performanceReviewRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/performance-analytics', performanceAnalyticsRoutes);
router.use('/documents', documentRoutes);
router.use('/document-categories', documentCategoryRoutes);
router.use('/document-requests', documentRequestRoutes);
router.use('/document-analytics', documentAnalyticsRoutes);
router.use('/recruitment', recruitmentRoutes);
router.use('/public', publicJobRoutes);
router.use('/onboarding-templates', onboardingTemplateRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/offboarding', offboardingRoutes);

// Order matters: these literal sub-paths are registered before the generic
// /assets router below, so they're matched first instead of falling through
// to its /:id pattern (e.g. GET /assets/categories would otherwise be
// captured as /assets/:id with id="categories").
router.use('/assets/categories', assetCategoryRoutes);
router.use('/assets/vendors', assetVendorRoutes);
router.use('/assets/requests', assetRequestRoutes);
router.use('/assets/maintenance', assetMaintenanceRoutes);
router.use('/assets/analytics', assetAnalyticsRoutes);
router.use('/assets', assetRoutes);

router.use('/payroll/components', salaryComponentRoutes);
router.use('/payroll/structures', salaryStructureRoutes);
router.use('/payroll/compensation', employeeCompensationRoutes);
router.use('/payroll/periods', payrollPeriodRoutes);
router.use('/payroll/runs', payrollRunRoutes);
router.use('/payroll/payslips', payslipRoutes);
router.use('/payroll/analytics', payrollAnalyticsRoutes);

module.exports = router;
