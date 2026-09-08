const { param } = require('express-validator');
const { validate } = require('./index');

const byId = [param('id').isMongoId().withMessage('Invalid payslip ID'), validate];

module.exports = { byId };
