/**
 * Profile access — installed-state truth source (official semantics:
 * `$DSH_HOME/profiles/<name>/package.json` carries `dsh.profile.bundles`
 * (ordered bundle names) and pnpm-managed `dependencies`).
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ProfileManifest {
  name?: string;
  dependencies?: Record<string, string>;
  dsh?: {
    profile?: {
      bundles?: string[];
    };
  };
}

/** One installed bundle in a profile. */
export interface InstalledPlugin {
  /** Bundle package name. */
  id: string;
  type: "bundle" | "git" | "skill";
  /** Dependency spec from the profile manifest (e.g. "^1.2.3", "github:o/r#sha"). */
  installedVersion?: string;
}

/** Harness home: `$DSH_HOME` or `~/.dsh`. */
export function resolveDshHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.DSH_HOME ?? join(homedir(), ".dsh");
}

/** Profile directory: `$DSH_HOME/profiles/<name>`. */
export function resolveProfileDir(profile: string, dshHome?: string): string {
  return join(dshHome ?? resolveDshHome(), "profiles", profile);
}

/** Read the profile manifest; null when the profile does not exist yet. */
export async function readProfileManifest(
  profile: string,
  dshHome?: string,
): Promise<ProfileManifest | null> {
  try {
    const raw = await readFile(join(resolveProfileDir(profile, dshHome), "package.json"), "utf8");
    return JSON.parse(raw) as ProfileManifest;
  } catch {
    return null;
  }
}

/**
 * List installed bundles of a profile (the ordered `dsh.profile.bundles`
 * list, with versions from `dependencies` when present).
 */
export async function listInstalled(
  profile: string,
  dshHome?: string,
): Promise<InstalledPlugin[]> {
  const manifest = await readProfileManifest(profile, dshHome);
  const bundles = manifest?.dsh?.profile?.bundles ?? [];
  return bundles.map((name) => ({
    id: name,
    type: "bundle" as const,
    installedVersion: manifest?.dependencies?.[name],
  }));
}
