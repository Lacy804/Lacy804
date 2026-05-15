function parseAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function applyCors(req, res) {
  const allowed = parseAllowedOrigins();
  const origin = req.headers.origin;

  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (allowed.length === 0) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export function handlePreflight(req, res) {
  if (req.method === "OPTIONS") {
    applyCors(req, res);
    res.status(204).end();
    return true;
  }
  return false;
}

export function sendError(res, status, message, detail) {
  res.status(status).json({
    error: { message, detail: detail ?? null },
  });
}

export function parseDays(req, fallback = 90) {
  const raw = req.query?.days;
  if (raw == null) return fallback;
  const n = Number.parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 480); // GSC retains ~16 months
}

export function parseLimit(req, fallback, max) {
  const raw = req.query?.limit;
  if (raw == null) return fallback;
  const n = Number.parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}
