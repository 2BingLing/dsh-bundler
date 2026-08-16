/**
 * Manifest parsing & validation (SPEC §4).
 *
 * Hard errors only for: invalid JSON, wrong kind, unsupported schemaVersion,
 * missing required fields, malformed entries. Everything else is a warning —
 * the forward-compat laws say unknown things are preserved, never fatal.
 */

import {
  KIND,
  PLUGIN_TYPES,
  SCHEMA_VERSION,
  type DshPack,
  type ManifestError,
  type ManifestResult,
  type ManifestWarning,
  type PackEntry,
} from "./types.js";

/** Date anchor: YYYY-MM-DD. */
const DATE_ANCHOR_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Commit pin: optional "#" prefix (git form) + 40-hex SHA. */
const COMMIT_RE = /^#?[0-9a-f]{40}$/i;
/** Loose semver/range shapes: 1.2.3, >=1.2.0, ^1.2, ~1.2, 1.x, * ... */
const SEMVER_RANGE_RE = /^[0-9*]+(?:\.[0-9x*]+){0,2}(?:-[0-9A-Za-z.-]+)?(?:[+][0-9A-Za-z.-]+)?$/;
const RANGE_OP_RE = /^[<>=~^]+/;

/**
 * Parse a JSON string into a manifest.
 * Returns errors (with `manifest: null`) for invalid JSON or invalid documents.
 */
export function parseManifest(input: string): ManifestResult {
  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      manifest: null,
      errors: [{ code: "invalid-json", message: `invalid JSON: ${message}` }],
      warnings: [],
    };
  }
  return validateManifest(data);
}

/** Validate an unknown value against the SPEC v0.1 schema. */
export function validateManifest(data: unknown): ManifestResult {
  const errors: ManifestError[] = [];
  const warnings: ManifestWarning[] = [];
  const KNOWN_TOP_LEVEL = new Set([
    "schemaVersion",
    "kind",
    "name",
    "description",
    "author",
    "plugins",
    "config",
    "ext",
  ]);

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return {
      manifest: null,
      errors: [{ code: "entry-syntax", message: "manifest must be a JSON object" }],
      warnings: [],
    };
  }

  const raw = data as Record<string, unknown>;

  // Law 1: unknown top-level fields are preserved and ignored.
  for (const key of Object.keys(raw)) {
    if (!KNOWN_TOP_LEVEL.has(key)) {
      warnings.push({ code: "unknown-field", message: `unknown top-level field "${key}" ignored`, path: key });
    }
  }

  // schemaVersion — hard error when missing or unsupported (law 3: never mis-parse).
  const schemaVersion = raw["schemaVersion"];
  if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion)) {
    errors.push({ code: "schema-version", message: "schemaVersion must be an integer", path: "schemaVersion" });
  } else if (schemaVersion !== SCHEMA_VERSION) {
    errors.push({
      code: "schema-version",
      message: `unsupported schemaVersion ${schemaVersion} (this implementation supports ${SCHEMA_VERSION}); check for a migration table entry`,
      path: "schemaVersion",
    });
  }

  // kind — must be exact (SPEC §3).
  if (raw["kind"] !== KIND) {
    errors.push({ code: "kind", message: `kind must be "${KIND}"`, path: "kind" });
  }

  // name — required, human readable.
  if (typeof raw["name"] !== "string" || raw["name"].trim() === "") {
    errors.push({ code: "missing-field", message: "name is required and must be a non-empty string", path: "name" });
  }

  // Optional scalars — present-but-wrong types are errors.
  for (const key of ["description", "author"] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== "string") {
      errors.push({ code: "entry-syntax", message: `${key} must be a string`, path: key });
    }
  }

  // plugins — required array.
  if (raw["plugins"] === undefined) {
    errors.push({ code: "missing-field", message: "plugins is required", path: "plugins" });
  } else if (!Array.isArray(raw["plugins"])) {
    errors.push({ code: "entry-syntax", message: "plugins must be an array", path: "plugins" });
  }

  // Entries.
  const plugins: PackEntry[] = [];
  if (Array.isArray(raw["plugins"])) {
    raw["plugins"].forEach((entry, index) => {
      const path = `plugins[${index}]`;
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        errors.push({ code: "entry-syntax", message: "entry must be an object", path });
        return;
      }
      const e = entry as Record<string, unknown>;

      if (typeof e["id"] !== "string" || e["id"].trim() === "") {
        errors.push({ code: "entry-syntax", message: "entry.id is required and must be a non-empty string", path: `${path}.id` });
        return;
      }

      // Law 2: unknown entry types are preserved + warned, never fatal.
      if (typeof e["type"] !== "string" || e["type"].trim() === "") {
        warnings.push({ code: "unknown-entry-type", message: "entry.type missing or invalid; entry will be skipped at install time", path: `${path}.type` });
      } else if (!PLUGIN_TYPES.includes(e["type"] as (typeof PLUGIN_TYPES)[number])) {
        warnings.push({ code: "unknown-entry-type", message: `unknown entry type "${e["type"]}"; entry will be skipped at install time`, path: `${path}.type` });
      }

      // Version — defaults to "latest"; unrecognized shapes are warned (intent, not contract).
      let version: string | undefined;
      if (e["version"] === undefined || e["version"] === null || e["version"] === "") {
        version = "latest";
      } else if (typeof e["version"] === "string") {
        version = e["version"];
        if (!isRecognizedVersionSpec(version)) {
          warnings.push({ code: "unknown-version-spec", message: `unrecognized version spec "${version}"; will attempt resolution at install time`, path: `${path}.version` });
        }
      } else {
        errors.push({ code: "entry-syntax", message: "entry.version must be a string", path: `${path}.version` });
        return;
      }

      // Preserve the raw type value (validated/warned above; install time
      // skips anything unknown — law 2). The union is intentionally open.
      const normalized: PackEntry = { id: e["id"], type: e["type"] as PackEntry["type"], version };
      // Preserve unknown entry fields verbatim (law 1).
      for (const key of Object.keys(e)) {
        if (!["id", "type", "version"].includes(key)) {
          (normalized as Record<string, unknown>)[key] = e[key];
        }
      }
      plugins.push(normalized);
    });
  }

  if (errors.length > 0) {
    return { manifest: null, errors, warnings };
  }

  const manifest: DshPack = {
    schemaVersion: schemaVersion as number,
    kind: raw["kind"] as string,
    name: raw["name"] as string,
    plugins,
  };
  // config / ext pass through verbatim (SPEC §4.4 / §4.5) — validated by the caller, not by us.
  for (const key of ["description", "author", "config", "ext"] as const) {
    if (raw[key] !== undefined) {
      (manifest as Record<string, unknown>)[key] = raw[key];
    }
  }
  // Unknown top-level fields preserved (law 1).
  for (const key of Object.keys(raw)) {
    if (!KNOWN_TOP_LEVEL.has(key)) {
      (manifest as Record<string, unknown>)[key] = raw[key];
    }
  }

  return { manifest, errors, warnings };
}

/** Recognized shapes: latest | semver/range | YYYY-MM-DD | 40-hex commit. */
function isRecognizedVersionSpec(spec: string): boolean {
  const s = spec.trim();
  if (s === "latest" || s === "*") return true;
  if (DATE_ANCHOR_RE.test(s)) return true;
  if (COMMIT_RE.test(s)) return true;
  const core = s.replace(RANGE_OP_RE, "");
  return SEMVER_RANGE_RE.test(core);
}
