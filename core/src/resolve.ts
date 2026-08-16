/**
 * Version resolution (SPEC §4.3).
 *
 * A pack expresses intent, not contract: versions are resolved at install
 * time. Resolution failures throw — the orchestrator marks the entry
 * `failed` in the report and continues (SPEC §7.2: never abort the pack).
 *
 * Specifier semantics:
 *   latest          → newest available version
 *   semver range    → any version satisfying the range, prefer newest
 *   YYYY-MM-DD      → date anchor: newest version published on/before that date
 *   commit SHA      → exact pin, no resolution needed
 *
 * Data sources per entry type (design doc §8):
 *   skill  → GitHub API (releases first for dates, tags fallback)
 *   cordis → npm registry (versions + time map)
 *   bundle → npm registry (official bundles are npm packages)
 *
 * Throttling & caching: sources serialize requests (RateLimiter) and cache
 * listings (TtlCache, 5 min) — see sources/.
 */

import semver from "semver";
import { PLUGIN_TYPES, type PackEntry, type PluginType, type VersionSpec } from "./types.js";
import { GitHubSource, NpmSource } from "./sources/index.js";
import type { VersionInfo, VersionSource } from "./sources/index.js";

export interface ResolveContext {
  /** Time of install (used for date anchors / "latest" semantics). */
  now?: Date;
  /** GitHub token (optional; raises API rate limits). */
  githubToken?: string;
  /** npm registry base URL. */
  npmRegistry?: string;
  /** Listings cache TTL for the default sources (ms). Default: 5 min. */
  cacheTtlMs?: number;
  /** Inject sources per entry type (tests / custom backends). */
  sources?: Partial<Record<PluginType, VersionSource>>;
}

export interface ResolvedEntry {
  entry: PackEntry;
  status: "ok" | "skip";
  /** Concrete version to install, when known. */
  resolvedVersion?: string;
  /** Publication time of the resolved version, when the source knows it. */
  publishedAt?: string;
  /** Human-readable reason for skips. */
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

/**
 * Resolve one entry to a concrete version.
 *
 * Throws on resolution failure (orchestrator converts to `failed`);
 * returns `status: "skip"` for entries that must not be installed
 * (unknown entry types — SPEC law 2: warn + skip + report).
 */
export async function resolveEntry(entry: PackEntry, ctx: ResolveContext = {}): Promise<ResolvedEntry> {
  const type = entry.type as string;
  if (!PLUGIN_TYPES.includes(type as PluginType)) {
    return {
      entry,
      status: "skip",
      reason: `unknown entry type "${type}" (SPEC law 2: warn + skip + report)`,
    };
  }

  const spec = (entry.version ?? "latest").trim();
  const kind = classifyVersionSpec(spec);

  // Commit pins are exact by definition — no resolution, no network.
  if (kind === "commit") {
    return { entry, status: "ok", resolvedVersion: spec };
  }

  const source = getSource(type as PluginType, ctx);
  const versions = await source.listVersions(entry.id);
  const picked = pickVersion(versions, kind, spec, ctx.now ?? new Date());
  if (!picked) {
    throw new Error(
      kind === "date"
        ? `no version published on or before ${spec} for ${entry.id} (date anchors need a source with release dates)`
        : `no version satisfies "${spec}" for ${entry.id}`,
    );
  }
  return { entry, status: "ok", resolvedVersion: picked.version, publishedAt: picked.publishedAt };
}

/**
 * Pick the version that satisfies `kind`/`spec` out of `versions`.
 * Returns null when nothing matches. Exported for direct testing.
 */
export function pickVersion(
  versions: VersionInfo[],
  kind: VersionSpecKind,
  spec: string,
  _now: Date,
): VersionInfo | null {
  if (versions.length === 0) return null;

  switch (kind) {
    case "latest": {
      const sorted = sortBySemverDesc(versions);
      return sorted[0] ?? null;
    }
    case "range": {
      const candidates = versions.filter((v) => parseSemver(v.version) !== null);
      const max = semver.maxSatisfying(candidates.map((c) => parseSemver(c.version)!), spec);
      if (!max) return null;
      return candidates.find((c) => parseSemver(c.version) === max) ?? null;
    }
    case "date": {
      const anchor = new Date(spec).getTime();
      const candidates = versions
        .filter((v) => v.publishedAt && new Date(v.publishedAt).getTime() <= anchor)
        .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime());
      return candidates[0] ?? null;
    }
    default:
      return null;
  }
}

/** Sort versions newest-first; non-semver tags sink to the bottom. */
export function sortBySemverDesc(versions: VersionInfo[]): VersionInfo[] {
  return [...versions].sort((a, b) => {
    const av = parseSemver(a.version);
    const bv = parseSemver(b.version);
    if (av && bv) return semver.rcompare(av, bv);
    if (av && !bv) return -1;
    if (!av && bv) return 1;
    return String(a.version).localeCompare(String(b.version));
  });
}

/** Strip a leading "v" and validate as semver; null when not a version. */
export function parseSemver(version: string): string | null {
  const cleaned = version.startsWith("v") ? version.slice(1) : version;
  return semver.valid(cleaned);
}

// --- default source wiring (module-level singletons: shared limiters/caches) ---

let defaultSources: Record<PluginType, VersionSource> | null = null;

function getSource(type: PluginType, ctx: ResolveContext): VersionSource {
  const injected = ctx.sources?.[type];
  if (injected) return injected;

  if (!defaultSources) {
    const github = new GitHubSource({ token: ctx.githubToken, cacheTtlMs: ctx.cacheTtlMs });
    const npm = new NpmSource({ registry: ctx.npmRegistry, cacheTtlMs: ctx.cacheTtlMs });
    defaultSources = { skill: github, cordis: npm, bundle: npm };
  }
  return defaultSources[type];
}

/** Reset the default source singletons (tests). */
export function resetDefaultSources(): void {
  defaultSources = null;
}
