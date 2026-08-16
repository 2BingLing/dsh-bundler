/**
 * Version resolution tests — SPEC §4.3.
 */

import { describe, expect, it } from "vitest";
import {
  classifyVersionSpec,
  parseSemver,
  pickVersion,
  resolveEntry,
  sortBySemverDesc,
} from "../src/index.js";
import type { VersionInfo, VersionSource } from "../src/index.js";

const mkEntry = (over: Record<string, unknown> = {}) => ({
  id: "owner/repo",
  type: "skill",
  version: "latest",
  ...over,
});

const mockSource = (versions: VersionInfo[], fail = false): VersionSource => ({
  listVersions: async () => {
    if (fail) throw new Error("source exploded");
    return versions;
  },
});

const versions: VersionInfo[] = [
  { version: "1.0.0", publishedAt: "2026-01-01T00:00:00Z" },
  { version: "1.2.0", publishedAt: "2026-03-01T00:00:00Z" },
  { version: "2.0.0", publishedAt: "2026-06-01T00:00:00Z" },
  { version: "v0.9.0", publishedAt: "2025-12-01T00:00:00Z" },
  { version: "nightly" },
];

describe("classifyVersionSpec", () => {
  it("recognizes latest", () => expect(classifyVersionSpec("latest")).toBe("latest"));
  it("defaults to latest", () => expect(classifyVersionSpec(undefined)).toBe("latest"));
  it("recognizes date anchors", () => expect(classifyVersionSpec("2026-08-15")).toBe("date"));
  it("recognizes commit pins", () => expect(classifyVersionSpec("a".repeat(40))).toBe("commit"));
  it("treats semver ranges as range", () => expect(classifyVersionSpec(">=1.2.0")).toBe("range"));
  it("treats anything else as range (lenient — intent, not contract)", () =>
    expect(classifyVersionSpec("weird")).toBe("range"));
});

describe("parseSemver", () => {
  it("parses plain versions", () => expect(parseSemver("1.2.3")).toBe("1.2.3"));
  it("strips a leading v", () => expect(parseSemver("v1.2.3")).toBe("1.2.3"));
  it("keeps pre-release tags", () => expect(parseSemver("1.2.3-beta.1")).toBe("1.2.3-beta.1"));
  it("rejects non-semver", () => expect(parseSemver("nightly")).toBeNull());
});

describe("sortBySemverDesc", () => {
  it("sorts newest first with non-semver tags sinking to the bottom", () => {
    const sorted = sortBySemverDesc(versions).map((v) => v.version);
    expect(sorted).toEqual(["2.0.0", "1.2.0", "1.0.0", "v0.9.0", "nightly"]);
  });
});

describe("pickVersion", () => {
  const now = new Date("2026-08-15T00:00:00Z");

  it("latest returns the newest semver", () => {
    expect(pickVersion(versions, "latest", "latest", now)?.version).toBe("2.0.0");
  });

  it("range returns the newest satisfying version", () => {
    expect(pickVersion(versions, "range", ">=1.0.0 <2", now)?.version).toBe("1.2.0");
  });

  it("range with no match returns null", () => {
    expect(pickVersion(versions, "range", "^3.0.0", now)).toBeNull();
  });

  it("date anchor returns the newest version published on/before the date", () => {
    expect(pickVersion(versions, "date", "2026-04-01", now)?.version).toBe("1.2.0");
  });

  it("date anchor with no candidates returns null", () => {
    expect(pickVersion(versions, "date", "2025-01-01", now)).toBeNull();
  });

  it("date anchor needs release dates (tags-only versions cannot anchor)", () => {
    const tagsOnly = [{ version: "1.0.0" }, { version: "2.0.0" }];
    expect(pickVersion(tagsOnly, "date", "2026-01-01", now)).toBeNull();
  });

  it("empty list returns null", () => expect(pickVersion([], "latest", "latest", now)).toBeNull());
});

describe("resolveEntry", () => {
  it("resolves latest through the injected source", async () => {
    const entry = mkEntry();
    const resolved = await resolveEntry(entry, { sources: { skill: mockSource(versions) } });
    expect(resolved.status).toBe("ok");
    expect(resolved.resolvedVersion).toBe("2.0.0");
    expect(resolved.publishedAt).toBe("2026-06-01T00:00:00Z");
  });

  it("resolves a semver range through the source", async () => {
    const entry = mkEntry({ version: ">=1.0.0 <2" });
    const resolved = await resolveEntry(entry, { sources: { skill: mockSource(versions) } });
    expect(resolved.resolvedVersion).toBe("1.2.0");
  });

  it("resolves a date anchor", async () => {
    const entry = mkEntry({ version: "2026-04-01" });
    const resolved = await resolveEntry(entry, { sources: { skill: mockSource(versions) } });
    expect(resolved.resolvedVersion).toBe("1.2.0");
  });

  it("commit pins short-circuit without any source", async () => {
    const sha = "b".repeat(40);
    const entry = mkEntry({ version: sha });
    const resolved = await resolveEntry(entry, {});
    expect(resolved.status).toBe("ok");
    expect(resolved.resolvedVersion).toBe(sha);
  });

  it("unknown entry types skip with a law-2 reason, without touching sources", async () => {
    const entry = mkEntry({ type: "hyperdrive" });
    const source = mockSource(versions);
    const spy = { ...source, listVersions: async () => { throw new Error("must not be called"); } };
    const resolved = await resolveEntry(entry, { sources: { skill: spy } });
    expect(resolved.status).toBe("skip");
    expect(resolved.reason).toContain("law 2");
  });

  it("throws when nothing satisfies the spec (orchestrator marks it failed)", async () => {
    const entry = mkEntry({ version: "^3.0.0" });
    await expect(resolveEntry(entry, { sources: { skill: mockSource(versions) } })).rejects.toThrow(
      "no version satisfies",
    );
  });

  it("propagates source failures (orchestrator marks it failed)", async () => {
    const entry = mkEntry();
    await expect(resolveEntry(entry, { sources: { skill: mockSource([], true) } })).rejects.toThrow(
      "source exploded",
    );
  });
});
