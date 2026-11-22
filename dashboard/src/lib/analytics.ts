// Server-only anonymous analytics logic for BrainWeb.
// Accepts a random installation UUID and records a daily check-in.
// Never receives or stores post text, URLs, browsing history, or IPs.

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_BODY_BYTES = 2048;

export function isValidInstallId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

// Activity date is always derived from the server clock (UTC),
// never from a client-supplied value.
export function utcActivityDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export type AnalyticsResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export type AnalyticsDeps = {
  supabaseUrl: string;
  serviceRoleKey: string;
  fetchImpl?: typeof fetch;
  now?: Date;
};

function restHeaders(serviceRoleKey: string, prefer?: string): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  return headers;
}

async function supabaseFetch(
  deps: AnalyticsDeps,
  path: string,
  init: RequestInit,
): Promise<void> {
  const doFetch = deps.fetchImpl ?? fetch;
  const response = await doFetch(`${deps.supabaseUrl}/rest/v1/${path}`, init);
  if (!response.ok) {
    throw new Error(`Supabase request failed with status ${response.status}`);
  }
}

// Records one anonymous check-in for an installation.
// Idempotent: repeated calls on the same UTC date do not duplicate
// daily_activity rows (primary key + ignore-duplicates).
export async function recordAnalyticsCheckIn(
  installId: string,
  deps: AnalyticsDeps,
): Promise<AnalyticsResult> {
  if (!isValidInstallId(installId)) {
    return { ok: false, status: 400, error: "Invalid installId" };
  }

  const now = deps.now ?? new Date();
  const nowIso = now.toISOString();
  const activityDate = utcActivityDate(now);

  try {
    // 1. Create the installation if missing; ignore if it already exists.
    await supabaseFetch(deps, "installations", {
      method: "POST",
      headers: restHeaders(deps.serviceRoleKey, "resolution=ignore-duplicates"),
      body: JSON.stringify({
        install_id: installId,
        first_seen_at: nowIso,
        last_seen_at: nowIso,
      }),
    });

    // 2. Refresh last_seen_at for existing installations.
    await supabaseFetch(
      deps,
      `installations?install_id=eq.${encodeURIComponent(installId)}`,
      {
        method: "PATCH",
        headers: restHeaders(deps.serviceRoleKey, "return=minimal"),
        body: JSON.stringify({ last_seen_at: nowIso }),
      },
    );

    // 3. Record daily activity idempotently.
    await supabaseFetch(deps, "daily_activity", {
      method: "POST",
      headers: restHeaders(deps.serviceRoleKey, "resolution=ignore-duplicates"),
      body: JSON.stringify({
        install_id: installId,
        activity_date: activityDate,
      }),
    });

    return { ok: true };
  } catch {
    return { ok: false, status: 500, error: "Failed to record analytics" };
  }
}
