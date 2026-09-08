export function method(req, allowed) {
  if (req.method !== allowed) return false;
  return true;
}

export function numberInRange(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max;
}

export function appUrl(req) {
  return process.env.APP_URL || `https://${req.headers.host}`;
}
