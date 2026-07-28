// JWT authentication middleware — placeholder for the next phase.
// Will verify Bearer tokens, attach req.user, and enforce RBAC.

function authenticate(req, res, next) {
  // TODO (Phase 2): verify JWT from Authorization header, load user, attach to req.user.
  next();
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    // TODO (Phase 2): check req.user.role against allowedRoles / permission map.
    next();
  };
}

module.exports = { authenticate, authorize };
