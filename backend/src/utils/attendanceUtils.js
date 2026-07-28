const { Organization } = require('../models');

const DEFAULTS = {
  workStartTime: '09:00',
  workEndTime: '18:00',
  lateThresholdMinutes: 15,
  minimumWorkingMinutes: 240,
  timeZone: 'Asia/Kolkata',
};

function getPart(parts, type) {
  const part = parts.find((p) => p.type === type);
  return part ? part.value : '';
}

function getOrgDate(timeZone, date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getOrgTimeInMinutes(timeZone, date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const h = parseInt(getPart(parts, 'hour'), 10) || 0;
  const m = parseInt(getPart(parts, 'minute'), 10) || 0;
  return h * 60 + m;
}

function timeStringToMinutes(str = '') {
  const [h, m] = str.split(':').map((s) => parseInt(s, 10));
  return (h || 0) * 60 + (m || 0);
}

async function getAttendanceSettings(organizationId) {
  const org = await Organization.findById(organizationId).lean();
  return {
    ...DEFAULTS,
    ...(org && org.attendanceSettings ? org.attendanceSettings : {}),
    timeZone: org && org.timeZone ? org.timeZone : DEFAULTS.timeZone,
  };
}

function formatMinutes(minutes = 0) {
  const m = Math.max(0, Math.floor(Number(minutes)));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}h ${rem}m`;
}

function formatTime(timeZone, date) {
  if (!date) return null;
  return new Date(date).toLocaleTimeString('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

module.exports = {
  DEFAULTS,
  getOrgDate,
  getOrgTimeInMinutes,
  timeStringToMinutes,
  getAttendanceSettings,
  formatMinutes,
  formatTime,
};
