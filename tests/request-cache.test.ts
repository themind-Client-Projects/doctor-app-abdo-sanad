import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheSize,
  clearCache,
  invalidate,
  load,
  snapshot,
  subscribe,
} from "@/lib/request-cache";

/**
 * The shared request layer every screen now reads through.
 *
 * Loading `/doctors` opened 26 sockets for 5 resources — a header, a list and a
 * drawer each honestly asking for `me` or `feature-flags`, doubled again by
 * StrictMode. These tests pin the two behaviours that collapse that, and the
 * two that are easy to get subtly wrong: snapshot identity (an unstable one
 * makes `useSyncExternalStore` re-render forever) and the difference between
 * "stale" and "never loaded".
 */

let calls: string[] = [];
let respond: (url: string) => { ok: boolean; body: unknown };

beforeEach(() => {
  clearCache();
  calls = [];
  respond = (url) => ({ ok: true, body: { data: { url } } });

  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const { ok, body } = respond(url);
    // A real network hop, so concurrent callers genuinely overlap.
    await new Promise((r) => setTimeout(r, 5));
    return { ok, json: async () => body } as Response;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearCache();
});

describe("one request per resource, however many ask", () => {
  it("collapses simultaneous asks into a single fetch", async () => {
    // Six components mounting at once — the storm this module exists for.
    await Promise.all([
      load("/api/v1/me"),
      load("/api/v1/me"),
      load("/api/v1/me"),
      load("/api/v1/me"),
      load("/api/v1/me"),
      load("/api/v1/me"),
    ]);

    expect(calls).toEqual(["/api/v1/me"]);
    expect(snapshot("/api/v1/me").data).toEqual({ url: "/api/v1/me" });
  });

  it("a later mount within the freshness window does not refetch", async () => {
    await load("/api/public/feature-flags");
    await load("/api/public/feature-flags");
    await load("/api/public/feature-flags");
    expect(calls).toHaveLength(1);
  });

  it("but a different query string is a different resource", async () => {
    await Promise.all([
      load("/api/public/doctors?channel=DIRECT"),
      load("/api/public/doctors?channel=SANAD"),
    ]);
    expect(calls.sort()).toEqual([
      "/api/public/doctors?channel=DIRECT",
      "/api/public/doctors?channel=SANAD",
    ]);
  });

  it("expiring the window lets the next read through", async () => {
    await load("/api/v1/me", { staleTime: 10 });
    await new Promise((r) => setTimeout(r, 25));
    await load("/api/v1/me", { staleTime: 10 });
    expect(calls).toHaveLength(2);
  });
});

describe("a write must not be served pre-write data", () => {
  it("force bypasses the freshness window", async () => {
    await load("/api/orders");
    await load("/api/orders", { force: true });
    expect(calls).toHaveLength(2);
  });

  it("invalidate makes the next read go to the network", async () => {
    await load("/api/orders");
    invalidate("/api/orders");
    await load("/api/orders");
    expect(calls).toHaveLength(2);
  });

  it("invalidate matches by prefix, so every query over a resource is covered", async () => {
    await Promise.all([load("/api/orders?status=NEW"), load("/api/orders?status=DONE")]);
    expect(calls).toHaveLength(2);

    invalidate("/api/orders");
    await Promise.all([load("/api/orders?status=NEW"), load("/api/orders?status=DONE")]);
    expect(calls).toHaveLength(4);
  });

  it("and leaves unrelated resources alone", async () => {
    await Promise.all([load("/api/orders"), load("/api/v1/me")]);
    invalidate("/api/orders");
    await Promise.all([load("/api/orders"), load("/api/v1/me")]);
    // orders refetched, me served from cache.
    expect(calls.filter((c) => c === "/api/v1/me")).toHaveLength(1);
    expect(calls.filter((c) => c === "/api/orders")).toHaveLength(2);
  });

  it("keeps the data readable while revalidating, so no skeleton flashes", async () => {
    await load("/api/orders");
    const before = snapshot("/api/orders");
    expect(before.isEmpty).toBe(false);

    invalidate("/api/orders");
    const during = snapshot("/api/orders");
    // Stale is not empty: the screen keeps showing what the user was reading.
    expect(during.isEmpty).toBe(false);
    expect(during.data).not.toBeNull();
  });
});

describe("snapshot identity", () => {
  it("is stable between notifications", async () => {
    await load("/api/v1/me");
    // An unstable identity here is what makes `useSyncExternalStore` loop.
    expect(snapshot("/api/v1/me")).toBe(snapshot("/api/v1/me"));
  });

  it("changes once new data lands", async () => {
    await load("/api/v1/me");
    const first = snapshot("/api/v1/me");
    await load("/api/v1/me", { force: true });
    expect(snapshot("/api/v1/me")).not.toBe(first);
  });

  it("an unknown key is stable too", () => {
    expect(snapshot("/api/never-asked")).toBe(snapshot("/api/never-asked"));
    expect(snapshot("/api/never-asked").isEmpty).toBe(true);
  });
});

describe("subscribers", () => {
  it("every subscriber is told when data lands", async () => {
    const hits = [0, 0, 0];
    const offs = hits.map((_, i) => subscribe("/api/v1/me", () => { hits[i]++; }));

    await load("/api/v1/me");
    expect(hits.every((h) => h > 0)).toBe(true);

    offs.forEach((off) => off());
  });

  it("unsubscribing the last reader keeps the cached data", async () => {
    const off = subscribe("/api/v1/me", () => {});
    await load("/api/v1/me");
    off();

    // Going back to a screen should be instant, not another round trip.
    await load("/api/v1/me");
    expect(calls).toHaveLength(1);
  });

  it("but an entry that never loaded is not kept", () => {
    const off = subscribe("/api/nothing-here", () => {});
    expect(cacheSize()).toBe(1);
    off();
    expect(cacheSize()).toBe(0);
  });
});

describe("failures", () => {
  it("a failed response becomes an error, not a rejection", async () => {
    respond = () => ({ ok: false, body: { error: "فشل في تحميل البيانات" } });
    await expect(load("/api/broken")).resolves.toBeUndefined();
    expect(snapshot("/api/broken").error).toBe("فشل في تحميل البيانات");
  });

  it("and a later success clears it", async () => {
    respond = () => ({ ok: false, body: { error: "مؤقت" } });
    await load("/api/flaky");
    expect(snapshot("/api/flaky").error).toBe("مؤقت");

    respond = (url) => ({ ok: true, body: { data: { url } } });
    await load("/api/flaky", { force: true });
    expect(snapshot("/api/flaky").error).toBeNull();
    expect(snapshot("/api/flaky").data).toEqual({ url: "/api/flaky" });
  });

  it("one failure does not stop the shared promise resolving for everyone", async () => {
    respond = () => ({ ok: false, body: { error: "فشل" } });
    const all = await Promise.allSettled([load("/api/broken"), load("/api/broken")]);
    expect(all.every((r) => r.status === "fulfilled")).toBe(true);
    expect(calls).toHaveLength(1);
  });
});

describe("signing out", () => {
  it("clearCache drops the previous user's data entirely", async () => {
    await load("/api/v1/me");
    expect(snapshot("/api/v1/me").data).not.toBeNull();

    clearCache();
    expect(snapshot("/api/v1/me").data).toBeNull();
    expect(cacheSize()).toBe(0);
  });
});
