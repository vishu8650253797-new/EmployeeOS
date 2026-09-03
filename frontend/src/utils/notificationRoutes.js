// Controlled entityType -> route mapping for notification deep links. The server
// only ever sends entityType/entityId (never a raw route string), so a
// compromised/buggy notification can't send a user to an arbitrary frontend
// path — every possible destination is enumerated here.
const ROUTE_BUILDERS = {
  Asset: (id) => `/assets/${id}`,
  AssetRequest: () => '/assets/requests',
  AssetMaintenance: () => '/assets/maintenance',
  Offboarding: (id) => `/offboarding/${id}`,
  LEAVE_REQUEST: () => '/my-leave',
  EMPLOYEE_DOCUMENT: () => '/my-documents',
  DOCUMENT_REQUEST: (id) => `/documents/requests/${id}`,
  JobApplication: (id) => `/recruitment/candidates/${id}`,
  Candidate: (id) => `/recruitment/candidates/${id}`,
  Interview: (id) => `/recruitment/interviews/${id}`,
  JobOffer: (id) => `/recruitment/offers/${id}`,
};

export function getNotificationRoute(entityType, entityId) {
  const builder = ROUTE_BUILDERS[entityType];
  if (!builder || !entityId) return null;
  return builder(entityId);
}
