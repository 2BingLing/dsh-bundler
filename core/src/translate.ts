/**
 * Translation layer (SPEC law 4) — the ONLY place that knows harness commands.
 *
 * If the official DSH CLI changes, only this file (or a template override)
 * changes. `core/` never installs plugins itself; it produces commands and
 * lets the harness run them.
 *
 * Default templates (aligned with the official CLI 2026-08-16:
 * `dsh plugin --profile <name> <pnpm args>` — `--profile` is required):
 *   bundle → dsh plugin --profile {profile} add {id}
 *   git    → dsh plugin --profile {profile} add github:{id}[#{sha}]
 *   skill  → kind: "skill-install" (file channel, not a shell command)
 *
 * Templates support {id}, {version} and {profile} placeholders. A `profile`
 * is carried as a separate field for the runner to apply (e.g. --profile).
 */

import type { PackEntry, PluginType } from "./types.js";
import type { ResolvedEntry } from "./resolve.js";

/** A shell command run by the harness (default kind). */
export interface ShellCommand {
  kind?: "shell";
  argv: string[];
  /** Target profile (DSH `--profile`), applied by the runner. */
  profile?: string;
  /** Working directory for the command, when relevant. */
  cwd?: string;
}

/** A file-channel instruction: materialize a skill into a skill root. */
export interface SkillInstallCommand {
  kind: "skill-install";
  /** Skill directory name (the entry id). */
  name: string;
  /** Git source spec (owner/repo) when the skill ships from a repository. */
  source?: string;
  /** Resolved commit pin, when locked. */
  version?: string;
}

export type HarnessCommand = ShellCommand | SkillInstallCommand;

export interface TranslateContext {
  /** Command templates per entry type; overrides DEFAULT_TEMPLATES. */
  templates?: Partial<Record<PluginType, string[]>>;
  /** Target profile for every produced command. Defaults to "default". */
  profile?: string;
}

export const DEFAULT_TEMPLATES: Record<PluginType, string[]> = {
  bundle: ["dsh", "plugin", "--profile", "{profile}", "add", "{id}"],
  git: ["dsh", "plugin", "--profile", "{profile}", "add", "github:{id}"],
  skill: [], // skills translate to a skill-install command, not a template
};

const DEFAULT_PROFILE = "default";
const COMMIT_RE = /^[0-9a-f]{40}$/i;

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
  const profile = ctx.profile ?? DEFAULT_PROFILE;

  // Skills are files: emit a file-channel instruction (the runner materializes
  // SKILL.md into a skill root). `source` is an optional forward-compat field.
  if (type === "skill") {
    const source = typeof entry["source"] === "string" ? entry["source"] : undefined;
    return [{ kind: "skill-install", name: entry.id, source, version: resolved.resolvedVersion }];
  }

  const template = ctx.templates?.[type] ?? DEFAULT_TEMPLATES[type];
  if (!template) return [];

  let id = entry.id;
  // git commit pins ride on the git spec: github:owner/repo#<sha>
  if (type === "git" && resolved.resolvedVersion && COMMIT_RE.test(resolved.resolvedVersion)) {
    id = `${id}#${resolved.resolvedVersion}`;
  }

  const argv = template.map((part) =>
    part
      .replaceAll("{id}", id)
      .replaceAll("{version}", resolved.resolvedVersion ?? "")
      .replaceAll("{profile}", profile),
  );
  const cmd: ShellCommand = { argv, profile };
  return [cmd];
}
