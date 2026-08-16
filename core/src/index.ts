/**
 * dsh-bundler core — public API.
 *
 * Pure Node, zero DSH dependencies. The harness plugin (ui/) and any third
 * party consumer build on this package.
 */

export * from "./types.js";
export { parseManifest, validateManifest } from "./manifest.js";
export {
  classifyVersionSpec,
  parseSemver,
  pickVersion,
  resolveEntry,
  resetDefaultSources,
  sortBySemverDesc,
} from "./resolve.js";
export type { ResolveContext, ResolvedEntry, VersionSpecKind } from "./resolve.js";
export { DEFAULT_TEMPLATES, translateEntry } from "./translate.js";
export type { HarnessCommand, TranslateContext } from "./translate.js";
export { orchestrateInstall, retryFailed } from "./orchestrate.js";
export type { InstallDeps, InstallOutcome, InstallReport } from "./orchestrate.js";
export { satisfiesInstalled } from "./satisfies.js";
export * from "./sources/index.js";
