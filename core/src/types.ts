/**
 * dsh-bundler core — protocol types (SPEC v0.1).
 *
 * Reference: SPEC.md (canonical English) / SPEC.zh-CN.md.
 * Code comments are English; user-facing strings are i18n (zh/en).
 *
 * Every type here mirrors the protocol contract. Unknown fields are
 * preserved and never fail validation (forward-compat law 1).
 */

/** Protocol schema version this implementation understands. */
export const SCHEMA_VERSION = 1;

/** File-kind marker that identifies a dsh.pack.json document. */
export const KIND = "dsh-pack";

/**
 * Entry types recognized by SPEC v0.1 (SPEC §4.2, aligned with the official
 * ecosystem 2026-08-16): bundle (npm package) | git (owner/repo) | skill
 * (SKILL.md file). Unknown types are warn + skip + report (law 2).
 */
export const PLUGIN_TYPES = ["bundle", "git", "skill"] as const;

export type PluginType = (typeof PLUGIN_TYPES)[number];

/**
 * Version specifier (SPEC §4.3): "latest" | semver range | YYYY-MM-DD date
 * anchor | "#<40-hex>" commit pin (git) | exact version. A pack expresses
 * intent, not contract — resolution happens at install time.
 */
export type VersionSpec = string;

/** One plugin reference inside `plugins[]` (SPEC §4.2). */
export interface PackEntry {
  /** Identification per type: npm package name (bundle) / owner/repo (git) / skill directory name (skill). */
  id: string;
  /**
   * bundle | git | skill. Unknown values are preserved (law 2) — the
   * union plus string keeps autocomplete while staying open.
   */
  type: PluginType | (string & {});
  /** Defaults to "latest" when omitted. */
  version?: VersionSpec;
  /** Forward-compat: unknown entry fields are preserved, never validated (law 1). */
  [key: string]: unknown;
}

/** Reserved passthrough block (SPEC §4.4): forwarded verbatim, never validated. */
export type PackConfig = Record<string, unknown>;

/** Extension point (SPEC §4.5): namespaced free-form fields, never interpreted. */
export type PackExt = Record<string, unknown>;

/** A parsed dsh.pack.json document (SPEC §4.1). */
export interface DshPack {
  schemaVersion: number;
  kind: string;
  name: string;
  description?: string;
  author?: string;
  plugins: PackEntry[];
  config?: PackConfig;
  ext?: PackExt;
  /** Unknown top-level fields, preserved verbatim (law 1). */
  [key: string]: unknown;
}

/** Outcome of parse/validate: errors make the document invalid; warnings are forward-compat notices. */
export interface ManifestResult {
  /** Normalized manifest (plugins defaulted to [] and versions to "latest"), or null when errors exist. */
  manifest: DshPack | null;
  errors: ManifestError[];
  warnings: ManifestWarning[];
}

export interface ManifestError {
  code: "invalid-json" | "schema-version" | "kind" | "missing-field" | "entry-syntax";
  message: string;
  /** JSON-pointer-ish path, e.g. "plugins[2].id". */
  path?: string;
}

export interface ManifestWarning {
  code: "unknown-field" | "unknown-entry-type" | "unknown-version-spec";
  message: string;
  path?: string;
}
