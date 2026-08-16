/**
 * Translation layer (SPEC law 4) — the ONLY place that knows harness commands.
 *
 * If the official DSH CLI changes, only this file (or a template override)
 * changes. `core/` never installs plugins itself; it produces commands and
 * lets the harness run them.
 *
 * Default templates (design doc §8/§9 — skill install shape is configurable
 * until the official CLI settles):
 *   skill  → dsh plugin add --type skill {id}
 *   cordis → dsh plugin add {id}
 *   bundle → dsh plugin add {id}
 *
 * Templates support {id} and {version} placeholders. A `profile` is carried
 * as a separate field for the runner to apply (e.g. --profile).
 */

import type { PackEntry, PluginType } from "./types.js";
import type { ResolvedEntry } from "./resolve.js";

/** A harness command, ready for execution by the harness runner. */
export interface HarnessCommand {
  argv: string[];
  /** Optional target profile (DSH `--profile`), applied by the runner. */
  profile?: string;
  /** Working directory for the command, when relevant. */
  cwd?: string;
}

export interface TranslateContext {
  /** Command templates per entry type; overrides DEFAULT_TEMPLATES. */
  templates?: Partial<Record<PluginType, string[]>>;
  /** Target profile for every produced command. */
  profile?: string;
}

export const DEFAULT_TEMPLATES: Record<PluginType, string[]> = {
  skill: ["dsh", "plugin", "add", "--type", "skill", "{id}"],
  cordis: ["dsh", "plugin", "add", "{id}"],
  bundle: ["dsh", "plugin", "add", "{id}"],
};

/**
 * Translate one resolved entry into harness commands.
 * Returns [] for entries with no known template (unknown types are skipped
 * upstream by the resolver, so this is a defensive fallback).
 */
export function translateEntry(
  entry: PackEntry,
  resolved: ResolvedEntry,
  ctx: TranslateContext = {},
): HarnessCommand[] {
  const type = entry.type as PluginType;
  const template = ctx.templates?.[type] ?? DEFAULT_TEMPLATES[type];
  if (!template) return [];

  const argv = template.map((part) =>
    part
      .replaceAll("{id}", entry.id)
      .replaceAll("{version}", resolved.resolvedVersion ?? ""),
  );
  const cmd: HarnessCommand = { argv };
  if (ctx.profile) cmd.profile = ctx.profile;
  return [cmd];
}
