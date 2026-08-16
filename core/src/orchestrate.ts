/**
 * Orchestration (SPEC §7) — sequential install with idempotent skips,
 * per-entry failure isolation, snapshot rollback, and a final report.
 *
 * Error-handling laws:
 *   - a failing entry MUST NOT interrupt the pack (v0.1 has no stopOnError);
 *   - rollback only rolls back this install's changes (snapshot before);
 *   - anything unknown: warn + skip + report, never hard-fail.
 *
 * TODO(M1): implement. The runner is injected so core stays pure Node and
 * testable — the harness supplies the actual command execution.
 */

import type { DshPack } from "./types.js";
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
  summary: {
    installed: number;
    skipped: number;
    failed: number;
  };
}

/** What the harness must provide: resolve, translate, run, and idempotency checks. */
export interface InstallDeps {
  resolve(entry: DshPack["plugins"][number]): Promise<ResolvedEntry>;
  translate(entry: DshPack["plugins"][number], resolved: ResolvedEntry): HarnessCommand[];
  run(command: HarnessCommand): Promise<void>;
  /** True when the entry is already installed and satisfies its version spec. */
  isSatisfied(entry: DshPack["plugins"][number], resolved: ResolvedEntry): Promise<boolean>;
  /** Snapshot installed state before executing; restored on failure. */
  snapshot(): Promise<unknown>;
  restore(snapshot: unknown): Promise<void>;
}

export async function orchestrateInstall(manifest: DshPack, deps: InstallDeps): Promise<InstallReport> {
  // TODO(M1): sequential execution in document order, per-entry try/catch,
  // idempotent skip, snapshot + rollback, summary report.
  void manifest;
  void deps;
  return { results: [], rolledBack: false, summary: { installed: 0, skipped: 0, failed: 0 } };
}
