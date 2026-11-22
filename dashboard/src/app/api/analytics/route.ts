import {
  MAX_BODY_BYTES,
  isValidInstallId,
  recordAnalyticsCheckIn,
} from "@/lib/analytics";

// Minimal in-memory rate limit: 30 check-ins per installId per hour.
// Best-effort abuse protection; resets on cold start. No IPs are stored.
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

function isRateLimited(installId: string): boolean {
  const now = Date.now();
  const timestamps = (hits.get(installId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (timestamps.length >= RATE_LIMIT_MAX) {
    hits.set(installId, timestamps);
    return true;
  }
  timestamps.push(now);
  hits.set(installId, timestamps);
  return false;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    Object.keys(body).length !== 1 ||
    !isValidInstallId((body as { installId?: unknown }).installId)
  ) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const installId = (body as { installId: string }).installId;

  if (isRateLimited(installId)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { error: "Analytics is not configured" },
      { status: 500 },
    );
  }

  const result = await recordAnalyticsCheckIn(installId, {
    supabaseUrl,
    serviceRoleKey,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ success: true }, { status: 200 });
}
