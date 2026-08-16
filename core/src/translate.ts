/**
 * Translation layer (SPEC law 4) — the ONLY place that knows harness commands.
 *
 * If the official DSH CLI changes, only this file changes. `core/` never
 * installs plugins itself; it produces commands and lets the harness run them.
 *
 * TODO(M1): implement per official CLI, e.g.:
 *   { id: "npm-pkg", type: "cordis" }            → ["dsh", "plugin", "add", "npm-pkg"]
 *   { id: "owner/repo", type: "skill" }          → TBD (depends on harness skill support;
 *                                                     design doc §9 lists fallback as open question)
 *   { id: "bundle-id", type: "bundle" }          → ["dsh", "plugin", "add", "bundle-id"]
 *   profile                                     → append ["--profile", profile] when set
 *
 * Unknown entry types never reach here — they are skipped upstream (law 2).
 */

import type { PackEntry } from "./types.js";
import type { ResolvedEntry } from "./resolve.js";

/** A harness command, ready for execution by the harness runner. */
export interface HarnessCommand {
  argv: string[];
  /** Optional target profile (DSH `--profile`). */
  profile?: string;
  /** Working directory for the command, when relevant. */
  cwd?: string;
}

export function translateEntry(entry: PackEntry, resolved: ResolvedEntry): HarnessCommand[] {
  // TODO(M1): map entry.type → official command shape; keep all command
  // knowledge in this module.
  void resolved;
  return [];
}
