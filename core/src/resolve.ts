/**
 * Version resolution (SPEC §4.3).
 *
 * A pack expresses intent, not contract: versions are resolved at install
 * time. Resolution never fails the pack — an unresolvable entry is reported
 * as `failed`/`skip` in the final report.
 *
 * TODO(M1): implement the resolvers against real data sources:
 *   - latest          → query newest available version
 *   - semver range    → query a satisfying version, prefer newest
 *   - YYYY-MM-DD      → date anchor: newest version published on/before that date
 *   - commit SHA      → exact pin, no resolution needed
 *
 * Data sources (per design doc §8): GitHub API for skill/bundle ids, npm
 * registry for cordis ids — reuse the throttling/caching experience from the
 * dsh-market collector (pagination intervals, caching). Until then, entries
 * resolve as no-op skips so the pipeline stays testable end-to-end.
 */

import type { PackEntry, VersionSpec } from "./types.js";

export interface ResolveContext {
  /** Time of install (used for date anchors / "latest" semantics). */
  now?: Date;
  /** GitHub token (optional, raises API rate limits). */
  githubToken?: string;
  /** npm registry base URL. */
  npmRegistry?: string;
  /** Skip network lookups; useful in tests and offline mode. */
  offline?: boolean;
}

export interface ResolvedEntry {
  entry: PackEntry;
  status: "ok" | "skip";
  /** Concrete version to install, when known. */
  resolvedVersion?: string;
  reason?: string;
}

/** Classify a version spec so resolvers can dispatch (SPEC §4.3). */
export type VersionSpecKind = "latest" | "range" | "date" | "commit" | "unknown";

export function classifyVersionSpec(spec: VersionSpec | undefined): VersionSpecKind {
  const s = (spec ?? "latest").trim();
  if (s === "latest") return "latest";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return "date";
  if (/^[0-9a-f]{40}$/i.test(s)) return "commit";
  return "range";
}

export async function resolveEntry(entry: PackEntry, ctx: ResolveContext = {}): Promise<ResolvedEntry> {
  // TODO(M1): dispatch on classifyVersionSpec() and query the data sources.
  void ctx;
  return {
    entry,
    status: "skip",
    reason: `version resolution not implemented yet (M1): ${entry.id}@${entry.version ?? "latest"}`,
  };
}
