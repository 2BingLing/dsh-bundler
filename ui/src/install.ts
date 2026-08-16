/**
 * Install data flow: dsh.pack.json text → validate → orchestrate → report.
 */

import {
  orchestrateInstall,
  parseManifest,
  type DshPack,
  type InstallDeps,
  type InstallReport,
  type ManifestError,
  type ManifestWarning,
} from "@dsh-bundler/core";

export interface ImportResult {
  phase: "ok" | "invalid";
  manifest: DshPack | null;
  errors: ManifestError[];
  warnings: ManifestWarning[];
}

/** Parse and validate dsh.pack.json text. */
export function importPack(jsonText: string): ImportResult {
  const result = parseManifest(jsonText);
  return {
    phase: result.manifest === null ? "invalid" : "ok",
    manifest: result.manifest,
    errors: result.errors,
    warnings: result.warnings,
  };
}

export interface InstallOutcome {
  import: ImportResult;
  report?: InstallReport;
}

/** Validate, then orchestrate the install when the pack is valid. */
export async function installPack(jsonText: string, deps: InstallDeps): Promise<InstallOutcome> {
  const imported = importPack(jsonText);
  if (imported.phase === "invalid" || imported.manifest === null) {
    return { import: imported };
  }
  const report = await orchestrateInstall(imported.manifest, deps);
  return { import: imported, report };
}
