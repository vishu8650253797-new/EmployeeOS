const timesheetService = require('../services/timesheetService');
const auditLogService = require('../services/auditLogService');

const reqMeta = (req) => auditLogService.requestMeta(req);

exports.getTimesheets = async (req, res) => {
  const { data, pagination } = await timesheetService.getMyTimesheets(req.organizationId, req.user, req.query);
  res.json({ success: true, data, pagination });
};

exports.getCurrentTimesheet = async (req, res) => {
  const data = await timesheetService.getCurrentTimesheet(req.organizationId, req.user);
  res.json({ success: true, data });
};

exports.getTimesheetById = async (req, res) => {
  const data = await timesheetService.getMyTimesheetById(req.organizationId, req.user, req.params.id);
  res.json({ success: true, data });
};

exports.getTimesheetEntries = async (req, res) => {
  const data = await timesheetService.getMyTimesheetEntries(req.organizationId, req.user, req.params.id);
  res.json({ success: true, data });
};

exports.prepareTimesheet = async (req, res) => {
  const data = await timesheetService.prepareTimesheet(req.organizationId, req.user, req.body, reqMeta(req));
  res.status(201).json({ success: true, message: 'Timesheet prepared', data });
};

exports.submitTimesheet = async (req, res) => {
  const data = await timesheetService.submitTimesheet(req.organizationId, req.user, req.params.id, reqMeta(req));
  res.json({ success: true, message: 'Timesheet submitted', data });
};
