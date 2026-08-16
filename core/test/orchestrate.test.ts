/**
 * Orchestration tests — SPEC §7 error-handling laws.
 */

import { describe, expect, it, vi } from "vitest";
import { orchestrateInstall, retryFailed } from "../src/index.js";
import type { DshPack, HarnessCommand, InstallDeps, PackEntry, ResolvedEntry } from "../src/index.js";

const manifest = (plugins: PackEntry[]): DshPack => ({
  schemaVersion: 1,
  kind: "dsh-pack",
  name: "test",
  plugins,
});

const entry = (id: string, type = "skill"): PackEntry => ({ id, type, version: "latest" });

function makeDeps(overrides: Partial<InstallDeps> = {}) {
  const calls = { runs: [] as HarnessCommand[], snapshots: 0, restores: 0 };
  const deps: InstallDeps = {
    resolve: async (e: PackEntry): Promise<ResolvedEntry> => ({
      entry: e,
      status: "ok",
      resolvedVersion: "1.0.0",
    }),
    translate: (e): HarnessCommand[] => [{ argv: ["dsh", "plugin", "add", e.id] }],
    run: async (c) => {
      calls.runs.push(c);
    },
    isSatisfied: async () => false,
    snapshot: async () => {
      calls.snapshots += 1;
      return { at: Date.now() };
    },
    restore: async () => {
      calls.restores += 1;
    },
    ...overrides,
  };
  return { deps, calls };
}

describe("orchestrateInstall", () => {
  it("installs every entry in document order", async () => {
    const { deps, calls } = makeDeps();
    const report = await orchestrateInstall(
      manifest([entry("a/b"), entry("npm-pkg", "cordis")]),
      deps,
    );
    expect(report.summary).toEqual({ installed: 2, skipped: 0, failed: 0 });
    expect(calls.runs.map((c) => c.argv.at(-1))).toEqual(["a/b", "npm-pkg"]);
    expect(report.rolledBack).toBe(false);
    expect(calls.restores).toBe(0);
  });

  it("takes the snapshot exactly once, lazily, before the first install", async () => {
    const { deps, calls } = makeDeps();
    const report = await orchestrateInstall(manifest([entry("a/b"), entry("c/d")]), deps);
    expect(report.summary.installed).toBe(2);
    expect(calls.snapshots).toBe(1);
  });

  it("skips entries that are already installed and satisfied (idempotent)", async () => {
    const { deps, calls } = makeDeps({
      isSatisfied: async () => true,
    });
    const report = await orchestrateInstall(manifest([entry("a/b")]), deps);
    expect(report.summary).toEqual({ installed: 0, skipped: 1, failed: 0 });
    expect(calls.runs).toHaveLength(0);
    expect(calls.snapshots).toBe(0);
    expect(report.results[0]?.detail).toContain("already installed");
  });

  it("reports resolver skips (e.g. unknown entry types) without running", async () => {
    const { deps, calls } = makeDeps({
      resolve: async (e) => ({ entry: e, status: "skip", reason: "unknown entry type (law 2)" }),
    });
    const report = await orchestrateInstall(manifest([entry("a/b", "hyperdrive" as never)]), deps);
    expect(report.summary).toEqual({ installed: 0, skipped: 1, failed: 0 });
    expect(calls.runs).toHaveLength(0);
    expect(calls.snapshots).toBe(0);
  });

  it("a failing entry does not interrupt the pack, and triggers rollback", async () => {
    const { deps, calls } = makeDeps({
      run: vi.fn(async (c: HarnessCommand) => {
        if (c.argv.at(-1) === "bad/plugin") throw new Error("install exploded");
      }),
    });
    const report = await orchestrateInstall(manifest([entry("bad/plugin"), entry("good/plugin")]), deps);
    expect(report.summary).toEqual({ installed: 1, skipped: 0, failed: 1 });
    expect(report.results[0]).toMatchObject({ entryId: "bad/plugin", status: "failed" });
    expect(report.results[0]?.detail).toContain("install exploded");
    expect(report.results[1]).toMatchObject({ entryId: "good/plugin", status: "installed" });
    expect(report.rolledBack).toBe(true);
    expect(calls.restores).toBe(1);
  });

  it("does not roll back when nothing was installed", async () => {
    const { deps, calls } = makeDeps({
      resolve: async (e) => ({ entry: e, status: "skip", reason: "nope" }),
    });
    const report = await orchestrateInstall(manifest([entry("a/b")]), deps);
    expect(report.summary).toEqual({ installed: 0, skipped: 1, failed: 0 });
    expect(calls.snapshots).toBe(0);
    expect(calls.restores).toBe(0);
    expect(report.rolledBack).toBe(false);
  });

  it("reports a rollback failure instead of crashing", async () => {
    const { deps } = makeDeps({
      run: async () => {
        throw new Error("install exploded");
      },
      restore: async () => {
        throw new Error("restore exploded");
      },
    });
    const report = await orchestrateInstall(manifest([entry("a/b")]), deps);
    expect(report.summary.failed).toBe(1);
    expect(report.rolledBack).toBe(false);
    expect(report.rollbackError).toContain("restore exploded");
  });

  it("marks entries with no produced command as skipped", async () => {
    const { deps, calls } = makeDeps({ translate: () => [] });
    const report = await orchestrateInstall(manifest([entry("a/b")]), deps);
    expect(report.summary).toEqual({ installed: 0, skipped: 1, failed: 0 });
    expect(report.results[0]?.detail).toContain("no harness command");
    expect(calls.snapshots).toBe(0);
  });

  it("handles an empty plugin list", async () => {
    const { deps, calls } = makeDeps();
    const report = await orchestrateInstall(manifest([]), deps);
    expect(report.summary).toEqual({ installed: 0, skipped: 0, failed: 0 });
    expect(report.rolledBack).toBe(false);
    expect(calls.snapshots).toBe(0);
    expect(calls.restores).toBe(0);
  });

  it("resolution failures are recorded as failed and do not interrupt the pack", async () => {
    const { deps, calls } = makeDeps({
      resolve: async (e) => {
        if (e.id === "bad/plugin") throw new Error("cannot resolve");
        return { entry: e, status: "ok", resolvedVersion: "1.0.0" };
      },
    });
    const report = await orchestrateInstall(manifest([entry("bad/plugin"), entry("good/plugin")]), deps);
    expect(report.summary).toEqual({ installed: 1, skipped: 0, failed: 1 });
    expect(calls.runs.map((c) => c.argv.at(-1))).toEqual(["good/plugin"]);
  });
});

describe("retryFailed", () => {
  it("re-runs only the failed entries", async () => {
    const { deps, calls } = makeDeps({
      run: vi.fn(async (c: HarnessCommand) => {
        if (c.argv.at(-1) === "bad/plugin") throw new Error("still broken");
      }),
    });
    const first = await orchestrateInstall(manifest([entry("bad/plugin"), entry("ok/plugin")]), deps);
    expect(first.summary.failed).toBe(1);

    const retry = await retryFailed(manifest([entry("bad/plugin"), entry("ok/plugin")]), deps, first);
    expect(retry.results.map((r) => r.entryId)).toEqual(["bad/plugin"]);
    expect(retry.summary).toEqual({ installed: 0, skipped: 0, failed: 1 });
  });
});
