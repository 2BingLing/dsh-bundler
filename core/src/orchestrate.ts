/**
 * Orchestration (SPEC §7) — sequential install with idempotent skips,
 * per-entry failure isolation, snapshot rollback, and a final report.
 *
 * Error-handling laws:
 *   - a failing entry MUST NOT interrupt the pack (v0.1 has no stopOnError);
 *   - rollback only rolls back this install's changes: the installed-state
 *     snapshot is taken lazily right before the first command runs;
 *   - anything unknown: warn + skip + report, never hard-fail.
 *
 * The runner is injected (`InstallDeps`) so core stays pure Node and fully
 * testable — the harness supplies the actual command execution.
 */

import type { DshPack, PackEntry } from "./types.js";
import type { ResolvedEntry } from "./resolve.js";
import type { HarnessCommand } from "./translate.js";

/** Per-entry outcome in the final report. */
export interface InstallOutcome {
  entryId: string;
  status: "installed" | "skipped" | "failed";
  detail?: string;
}

export interface InstallReport {
  results: InstallOutcome[];
  /** True when the pre-install snapshot was restored after failures. */
  rolledBack: boolean;
  /** Error message when the rollback itself failed. */
  rollbackError?: string;
  summary: {
    installed: number;
    skipped: number;
    failed: number;
  };
}

/** What the harness must provide: resolve, translate, run, idempotency, snapshot. */
export interface InstallDeps {
  resolve(entry: PackEntry): Promise<ResolvedEntry>;
  translate(entry: PackEntry, resolved: ResolvedEntry): HarnessCommand[];
  run(command: HarnessCommand): Promise<void>;
  /** True when the entry is already installed and satisfies its version spec. */
  isSatisfied(entry: PackEntry, resolved: ResolvedEntry): Promise<boolean>;
  /** Snapshot installed state before executing; restored on failure. */
  snapshot(): Promise<unknown>;
  restore(snapshot: unknown): Promise<void>;
}

/** Execute a pack: validation is the caller's job; we orchestrate. */
export async function orchestrateInstall(manifest: DshPack, deps: InstallDeps): Promise<InstallReport> {
  const results: InstallOutcome[] = [];
  let snapshot: unknown = null;

  for (const entry of manifest.plugins) {
    const outcome: InstallOutcome = { entryId: entry.id, status: "skipped" };
    try {
      const resolved = await deps.resolve(entry);
      if (resolved.status === "skip") {
        outcome.detail = resolved.reason ?? "skipped by resolver";
      } else if (await deps.isSatisfied(entry, resolved)) {
        outcome.detail = "already installed and satisfies version spec";
      } else {
        const cmds = deps.translate(entry, resolved);
        if (cmds.length === 0) {
          outcome.detail = "no harness command produced";
        } else {
          if (snapshot === null) snapshot = await deps.snapshot();
          for (const cmd of cmds) {
            await deps.run(cmd);
          }
          outcome.status = "installed";
        }
      }
    } catch (err) {
      outcome.status = "failed";
      outcome.detail = err instanceof Error ? err.message : String(err);
    }
    results.push(outcome);
  }

  const summary = summarize(results);
  let rolledBack = false;
  let rollbackError: string | undefined;

  // Rollback only when this install actually changed something and failed.
  if (snapshot !== null && summary.failed > 0) {
    try {
      await deps.restore(snapshot);
      rolledBack = true;
    } catch (err) {
      rollbackError = err instanceof Error ? err.message : String(err);
    }
  }

  return { results, rolledBack, rollbackError, summary };
}

/** Re-run only the entries that failed in a previous report. */
export async function retryFailed(
  manifest: DshPack,
  deps: InstallDeps,
  report: InstallReport,
): Promise<InstallReport> {
  const failedIds = new Set(
    report.results.filter((r) => r.status === "failed").map((r) => r.entryId),
  );
  const subset: DshPack = { ...manifest, plugins: manifest.plugins.filter((p) => failedIds.has(p.id)) };
  return orchestrateInstall(subset, deps);
}

function summarize(results: InstallOutcome[]): InstallReport["summary"] {
  const summary = { installed: 0, skipped: 0, failed: 0 };
  for (const r of results) {
    summary[r.status] += 1;
  }
  return summary;
}
