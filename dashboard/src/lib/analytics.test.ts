import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  isValidInstallId,
  utcActivityDate,
  recordAnalyticsCheckIn,
} from "./analytics";
import { POST } from "@/app/api/analytics/route";

const VALID_ID = "123e4567-e89b-42d3-a456-426614174000";
const SUPABASE_URL = "https://example.supabase.co";
const SERVICE_KEY = "test-service-role-key";

function mockFetchOk() {
  return vi.fn<typeof fetch>(async () => new Response("{}", { status: 201 }));
}

describe("isValidInstallId", () => {
  it("accepts a valid UUID", () => {
    expect(isValidInstallId(VALID_ID)).toBe(true);
    expect(isValidInstallId(VALID_ID.toUpperCase())).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isValidInstallId("not-a-uuid")).toBe(false);
    expect(isValidInstallId("")).toBe(false);
    expect(isValidInstallId(undefined)).toBe(false);
    expect(isValidInstallId(null)).toBe(false);
    expect(isValidInstallId(12345)).toBe(false);
    expect(isValidInstallId(`${VALID_ID}ff`)).toBe(false);
  });
});

describe("utcActivityDate", () => {
  it("returns YYYY-MM-DD in UTC", () => {
    expect(utcActivityDate(new Date("2026-11-22T15:30:00Z"))).toBe("2026-11-22");
    expect(utcActivityDate(new Date("2026-11-22T23:59:59Z"))).toBe("2026-11-22");
  });
});

describe("recordAnalyticsCheckIn", () => {
  const deps = {
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SERVICE_KEY,
    now: new Date("2026-11-22T10:00:00Z"),
  };

  it("creates installation and daily activity for a first-time install", async () => {
    const fetchImpl = mockFetchOk();
    const result = await recordAnalyticsCheckIn(VALID_ID, { ...deps, fetchImpl });

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    const [installUrl, installInit] = fetchImpl.mock.calls[0];
    expect(String(installUrl)).toBe(`${SUPABASE_URL}/rest/v1/installations`);
    expect((installInit?.headers as Record<string, string>).Prefer).toBe(
      "resolution=ignore-duplicates",
    );
    const installBody = JSON.parse(String(installInit?.body));
    expect(installBody.install_id).toBe(VALID_ID);
    expect(installBody.first_seen_at).toBe("2026-11-22T10:00:00.000Z");

    const [patchUrl, patchInit] = fetchImpl.mock.calls[1];
    expect(String(patchUrl)).toContain(`installations?install_id=eq.${VALID_ID}`);
    expect(patchInit?.method).toBe("PATCH");

    const [activityUrl, activityInit] = fetchImpl.mock.calls[2];
    expect(String(activityUrl)).toBe(`${SUPABASE_URL}/rest/v1/daily_activity`);
    const activityBody = JSON.parse(String(activityInit?.body));
    expect(activityBody).toEqual({
      install_id: VALID_ID,
      activity_date: "2026-11-22",
    });
  });

  it("uses the same activity_date for duplicate same-day check-ins", async () => {
    const fetchImpl = mockFetchOk();
    await recordAnalyticsCheckIn(VALID_ID, { ...deps, fetchImpl });
    await recordAnalyticsCheckIn(VALID_ID, { ...deps, fetchImpl });

    const activityBodies = fetchImpl.mock.calls
      .filter(([url]) => String(url).includes("daily_activity"))
      .map(([, init]) => JSON.parse(String(init?.body)));

    expect(activityBodies).toHaveLength(2);
    expect(activityBodies[0].activity_date).toBe(activityBodies[1].activity_date);
  });

  it("returns 500 when the database request fails", async () => {
    const fetchImpl = vi.fn(async () => new Response("error", { status: 500 }));
    const result = await recordAnalyticsCheckIn(VALID_ID, { ...deps, fetchImpl });
    expect(result).toEqual({ ok: false, status: 500, error: "Failed to record analytics" });
  });

  it("rejects an invalid installId without calling the database", async () => {
    const fetchImpl = mockFetchOk();
    const result = await recordAnalyticsCheckIn("bad-id", { ...deps, fetchImpl });
    expect(result).toEqual({ ok: false, status: 400, error: "Invalid installId" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("POST /api/analytics", () => {
  const ENV = {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  };

  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", ENV.SUPABASE_URL);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", ENV.SUPABASE_SERVICE_ROLE_KEY);
    vi.stubGlobal("fetch", mockFetchOk());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function postRequest(body: unknown, contentLength?: number) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (contentLength !== undefined) headers["content-length"] = String(contentLength);
    return new Request("https://dashboard.example/api/analytics", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  it("returns 400 when installId is missing", async () => {
    const res = await POST(postRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid installId", async () => {
    const res = await POST(postRequest({ installId: "nope" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for extra fields", async () => {
    const res = await POST(postRequest({ installId: VALID_ID, extra: 1 }));
    expect(res.status).toBe(400);
  });

  it("returns 413 for oversized payloads", async () => {
    const res = await POST(postRequest({ installId: VALID_ID }, 99999));
    expect(res.status).toBe(413);
  });

  it("returns 200 for a valid check-in", async () => {
    const res = await POST(postRequest({ installId: VALID_ID }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it("returns 500 when Supabase is not configured", async () => {
    vi.unstubAllEnvs();
    const res = await POST(postRequest({ installId: VALID_ID }));
    expect(res.status).toBe(500);
  });
});
