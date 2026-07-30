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

function getDocumentRoom(documentId) {
  return `document:${documentId}`;
}

function getDocumentRequestRoom(requestId) {
  return `document-request:${requestId}`;
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

const ELEVATED_DOC_ROLES = ['SUPER_ADMIN', 'HR_ADMIN'];

async function joinDocumentRoom(io, socket, documentId, EmployeeDocument) {
  const { organizationId, employeeId, role } = socket.user;

  const document = await EmployeeDocument.findOne({
    _id: documentId,
    organizationId: new (require('mongoose').Types.ObjectId)(organizationId),
    isDeleted: false,
  });

  if (!document) {
    throw new Error('Document not found or access denied');
  }

  const hasAccess = document.employeeId.toString() === employeeId || ELEVATED_DOC_ROLES.includes(role);
  if (!hasAccess) {
    throw new Error('You do not have access to this document');
  }

  socket.join(getDocumentRoom(documentId));
  return document;
}

function leaveDocumentRoom(socket, documentId) {
  socket.leave(getDocumentRoom(documentId));
}

async function joinDocumentRequestRoom(io, socket, requestId, DocumentRequest) {
  const { organizationId, employeeId, id: userId, role } = socket.user;

  const request = await DocumentRequest.findOne({
    _id: requestId,
    organizationId: new (require('mongoose').Types.ObjectId)(organizationId),
  });

  if (!request) {
    throw new Error('Document request not found or access denied');
  }

  const hasAccess =
    request.employeeId.toString() === employeeId ||
    request.requestedBy.toString() === userId ||
    ELEVATED_DOC_ROLES.includes(role);
  if (!hasAccess) {
    throw new Error('You do not have access to this document request');
  }

  socket.join(getDocumentRequestRoom(requestId));
  return request;
}

function leaveDocumentRequestRoom(socket, requestId) {
  socket.leave(getDocumentRequestRoom(requestId));
}

module.exports = {
  getUserRoom,
  getOrganizationRoom,
  getDepartmentRoom,
  getManagerRoom,
  getProjectRoom,
  getDocumentRoom,
  getDocumentRequestRoom,
  joinUserRooms,
  joinProjectRoom,
  leaveProjectRoom,
  joinDocumentRoom,
  leaveDocumentRoom,
  joinDocumentRequestRoom,
  leaveDocumentRequestRoom,
};
