// Standard API response helpers — keeps controllers concise and consistent.

function success(res, data, statusCode = 200) {
  res.status(statusCode).json({ success: true, data });
}

function created(res, data) {
  success(res, data, 201);
}

function paginated(res, data, pagination) {
  res.json({ success: true, data, pagination });
}

module.exports = { success, created, paginated };
