// Export all Mongoose models for multi-tenant HR platform.
// Additional models to be added in later phases.

module.exports = {
  Organization: require('./Organization'),
  User: require('./User'),
  Employee: require('./Employee'),
  Department: require('./Department'),
  Attendance: require('./Attendance'),
  LeaveRequest: require('./LeaveRequest'),
  // Role, Permission, Task, Document, PerformanceReview, Payroll,
  // Notification, AuditLog — to be implemented in Phase 2+
};
