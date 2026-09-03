// Minimal in-memory sliding-window limiter for Socket.IO. The existing
// express-rate-limit middleware is mounted on the HTTP `/api/` router and never
// sees the `/socket.io/` transport, so it can't be reused as-is here — this is
// a small, dependency-free counterpart scoped to handshakes and client-emitted
// events, not a second general-purpose rate-limiting system.

const buckets = new Map();

function isRateLimited(key, max, windowMs) {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    buckets.set(key, { windowStart: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

// Periodic sweep so the map doesn't grow unbounded with stale IP/socket keys.
// unref() keeps this timer from holding the test/CLI process open.
const sweepInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now - entry.windowStart > 5 * 60 * 1000) buckets.delete(key);
  }
}, 5 * 60 * 1000);
sweepInterval.unref();

function clearRateLimitState(key) {
  if (key) buckets.delete(key);
  else buckets.clear();
}

module.exports = { isRateLimited, clearRateLimitState };
