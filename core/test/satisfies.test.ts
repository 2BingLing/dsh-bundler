/**
 * satisfiesInstalled tests — SPEC §7.4 idempotency.
 */

import { describe, expect, it } from "vitest";
import { satisfiesInstalled } from "../src/index.js";

describe("satisfiesInstalled", () => {
  it("latest is always satisfied when installed", () => {
    expect(satisfiesInstalled("1.0.0", "latest")).toBe(true);
    expect(satisfiesInstalled("0.0.1", undefined)).toBe(true);
  });

  it("semver ranges compare against the installed version", () => {
    expect(satisfiesInstalled("1.2.3", ">=1.0.0 <2")).toBe(true);
    expect(satisfiesInstalled("1.2.3", "^1.0.0")).toBe(true);
    expect(satisfiesInstalled("1.2.3", "^2.0.0")).toBe(false);
    expect(satisfiesInstalled("1.2.3", "1.2.3")).toBe(true);
  });

  it("v-prefixed installed versions parse", () => {
    expect(satisfiesInstalled("v1.2.3", "^1.0.0")).toBe(true);
  });

  it("non-semver installed versions never satisfy a range", () => {
    expect(satisfiesInstalled("link:../plugin", "^1.0.0")).toBe(false);
  });

  it("date anchors and commit pins are never proven satisfied", () => {
    expect(satisfiesInstalled("1.2.3", "2026-08-15")).toBe(false);
    expect(satisfiesInstalled("1.2.3", "#a".repeat(40))).toBe(false);
  });
});
