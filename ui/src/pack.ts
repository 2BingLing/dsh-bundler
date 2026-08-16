/**
 * Pack data flow: installed plugins → dsh.pack.json (SPEC §4).
 */

import type { DshPack, PackEntry } from "@dsh-bundler/core";
import type { InstalledPlugin } from "./profile.js";

export interface PackOptions {
  /** Human-readable pack name (required by the protocol). */
  name: string;
  description?: string;
  author?: string;
  /** "latest" (default) writes intent; "current" records installed versions as exact pins. */
  versionStrategy?: "latest" | "current";
}

/** Build a dsh.pack.json from the installed plugin list. */
export function buildPack(installed: InstalledPlugin[], opts: PackOptions): DshPack {
  const plugins: PackEntry[] = installed.map((plugin) => ({
    id: plugin.id,
    type: plugin.type,
    version:
      opts.versionStrategy === "current" && plugin.installedVersion
        ? normalizeInstalledVersion(plugin.installedVersion)
        : "latest",
  }));
  const pack: DshPack = {
    schemaVersion: 1,
    kind: "dsh-pack",
    name: opts.name,
    plugins,
    config: {},
    ext: {},
  };
  if (opts.description !== undefined) pack.description = opts.description;
  if (opts.author !== undefined) pack.author = opts.author;
  return pack;
}

/** Serialize a pack to the canonical JSON text (2-space indent). */
export function serializePack(pack: DshPack): string {
  return `${JSON.stringify(pack, null, 2)}\n`;
}

/**
 * Extract an exact version from a pnpm dependency spec:
 * "^1.2.3" / "~1.2.3" / "1.2.3" → "1.2.3";
 * "link:..." / "github:o/r#sha" / "file:..." → "latest" (no exact version known).
 */
export function normalizeInstalledVersion(spec: string): string {
  const match = /^[~^]?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(spec.trim());
  return match?.[1] ?? "latest";
}
