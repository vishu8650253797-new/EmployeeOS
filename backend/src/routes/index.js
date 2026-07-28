const { Router } = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const employeeRoutes = require('./employeeRoutes');
const departmentRoutes = require('./departmentRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const attendanceRoutes = require('./attendanceRoutes');

const router = Router();

router.get('/health', (req, res) => {
  res.json({ success: true, service: 'EmployeeOS API', status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/employees', employeeRoutes);
router.use('/departments', departmentRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/attendance', attendanceRoutes);

// Phase 5+ route modules to be mounted here:
// router.use('/attendance', attendanceRoutes);
// router.use('/leave', leaveRoutes);

module.exports = router;
