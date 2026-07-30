// Export all Mongoose models for multi-tenant HR platform.
// Additional models to be added in later phases.

module.exports = {
  Organization: require('./Organization'),
  User: require('./User'),
  Employee: require('./Employee'),
  Department: require('./Department'),
  Attendance: require('./Attendance'),
  LeaveRequest: require('./LeaveRequest'),
  LeaveType: require('./LeaveType'),
  LeaveBalance: require('./LeaveBalance'),
  Notification: require('./Notification'),
  Project: require('./Project'),
  Task: require('./Task'),
  TaskComment: require('./TaskComment'),
  TaskActivity: require('./TaskActivity'),
  EmployeeDocument: require('./EmployeeDocument'),
  DocumentCategory: require('./DocumentCategory'),
  DocumentVersion: require('./DocumentVersion'),
  DocumentRequest: require('./DocumentRequest'),
  AuditLog: require('./AuditLog'),
};
