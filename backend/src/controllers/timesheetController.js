const timesheetService = require('../services/timesheetService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.getTimesheets = async (req, res) => {
  const { data, pagination } = await timesheetService.getManagerTimesheets(req.organizationId, req.user, req.query);
  res.json({ success: true, data, pagination });
};

exports.getTimesheetById = async (req, res) => {
  const data = await timesheetService.getManagerTimesheetById(req.organizationId, req.user, req.params.id);
  res.json({ success: true, data });
};

exports.getTimesheetEntries = async (req, res) => {
  const data = await timesheetService.getManagerTimesheetEntries(req.organizationId, req.user, req.params.id);
  res.json({ success: true, data });
};

exports.approveTimesheet = async (req, res) => {
  const data = await timesheetService.approveTimesheet(req.organizationId, req.user, req.params.id, reqMeta(req));
  res.json({ success: true, message: 'Timesheet approved', data });
};

exports.rejectTimesheet = async (req, res) => {
  const data = await timesheetService.rejectTimesheet(req.organizationId, req.user, req.params.id, req.body.reason, reqMeta(req));
  res.json({ success: true, message: 'Timesheet rejected', data });
};
