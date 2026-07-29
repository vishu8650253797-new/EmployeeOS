function getUserRoom(userId) {
  return `user:${userId}`;
}

function getOrganizationRoom(organizationId) {
  return `organization:${organizationId}`;
}

function getDepartmentRoom(departmentId) {
  return `department:${departmentId}`;
}

function getManagerRoom(managerId) {
  return `manager:${managerId}`;
}

function getProjectRoom(projectId) {
  return `project:${projectId}`;
}

function joinUserRooms(io, socket) {
  const { id, organizationId, employeeId, departmentId } = socket.user;
  socket.join(getUserRoom(id));
  if (organizationId) socket.join(getOrganizationRoom(organizationId));
  if (departmentId) socket.join(getDepartmentRoom(departmentId));
  if (employeeId) socket.join(getUserRoom(employeeId)); // legacy user-employee
}

async function joinProjectRoom(io, socket, projectId, Project) {
  const { id: userId, organizationId, employeeId } = socket.user;
  
  const project = await Project.findOne({
    _id: projectId,
    organizationId: new (require('mongoose').Types.ObjectId)(organizationId),
  });
  
  if (!project) {
    throw new Error('Project not found or access denied');
  }
  
  const hasAccess = 
    project.ownerId.toString() === employeeId ||
    project.members.some(m => m.toString() === employeeId) ||
    ['SUPER_ADMIN', 'HR_ADMIN'].includes(socket.user.role);
  
  if (!hasAccess) {
    throw new Error('You do not have access to this project');
  }
  
  socket.join(getProjectRoom(projectId));
  return project;
}

function leaveProjectRoom(socket, projectId) {
  socket.leave(getProjectRoom(projectId));
}

module.exports = { 
  getUserRoom, 
  getOrganizationRoom, 
  getDepartmentRoom, 
  getManagerRoom, 
  getProjectRoom,
  joinUserRooms,
  joinProjectRoom,
  leaveProjectRoom,
};
