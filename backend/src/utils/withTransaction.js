const mongoose = require('mongoose');

const UNSUPPORTED_TX_PATTERN = /Transaction numbers are only allowed on a replica set|Transactions are not supported/i;

let warnedFallback = false;

/**
 * Runs `fn(session)` inside a Mongo transaction when the deployment supports
 * one (replica set / sharded cluster). On a standalone deployment,
 * transactions aren't available — fall back to running `fn(null)` so callers
 * can perform the same sequential writes with their own compensating
 * rollback, matching the pattern already used in leaveRequestService.js.
 */
async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err) {
    if (UNSUPPORTED_TX_PATTERN.test(err.message || '')) {
      if (!warnedFallback) {
        console.warn('MongoDB transactions are not supported by this deployment — falling back to sequential writes for document operations.');
        warnedFallback = true;
      }
      return fn(null);
    }
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = { withTransaction };
