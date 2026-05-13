/**
 * Minimal smoke tests — covers the constant-time admin-key compare and
 * Origin allowlist short-circuit. End-to-end KV/handler tests will be
 * added in Phase 2 alongside the mutation paths.
 */
import { describe, expect, it } from "vitest";
import { checkAdminKey } from "../src/auth";
import { checkOrigin } from "../src/origin";

describe("checkAdminKey", () => {
  it("rejects when expected is empty", () => {
    expect(checkAdminKey("anything", undefined)).toBe(false);
    expect(checkAdminKey("anything", "")).toBe(false);
  });
  it("rejects null header", () => {
    expect(checkAdminKey(null, "secret")).toBe(false);
  });
  it("rejects mismatched length", () => {
    expect(checkAdminKey("short", "much-longer-secret")).toBe(false);
  });
  it("accepts exact match", () => {
    expect(checkAdminKey("hunter2-correct", "hunter2-correct")).toBe(true);
  });
  it("rejects same-length mismatch", () => {
    expect(checkAdminKey("hunter2-correct", "hunter2-wronger")).toBe(false);
  });
});

describe("checkOrigin", () => {
  function makeReq(origin: string | null): Request {
    const headers = new Headers();
    if (origin) headers.set("Origin", origin);
    return new Request("https://example.test/auth", { method: "POST", headers });
  }

  it("fails closed when allowlist is empty", () => {
    expect(checkOrigin(makeReq("https://anywhere"), undefined).ok).toBe(false);
    expect(checkOrigin(makeReq("https://anywhere"), "").ok).toBe(false);
  });

  it("allows wildcard", () => {
    const r = checkOrigin(makeReq("https://anywhere"), "*");
    expect(r.ok).toBe(true);
  });

  it("rejects unlisted origin", () => {
    const r = checkOrigin(makeReq("https://attacker.example"), "https://owner.valora.example");
    expect(r.ok).toBe(false);
  });

  it("rejects missing Origin header on non-wildcard config", () => {
    const r = checkOrigin(makeReq(null), "https://owner.valora.example");
    expect(r.ok).toBe(false);
  });

  it("accepts an allowlisted origin", () => {
    const r = checkOrigin(
      makeReq("https://owner.valora.example"),
      "https://owner.valora.example,https://localhost:4322"
    );
    expect(r.ok).toBe(true);
    expect(r.origin).toBe("https://owner.valora.example");
  });
});
