/**
 * dsh-bundler core — public API.
 *
 * Pure Node, zero DSH dependencies. The harness plugin (ui/) and any third
 * party consumer build on this package.
 */

export * from "./types.js";
export { parseManifest, validateManifest } from "./manifest.js";
export { classifyVersionSpec, resolveEntry } from "./resolve.js";
export type { ResolveContext, ResolvedEntry, VersionSpecKind } from "./resolve.js";
export { translateEntry } from "./translate.js";
export type { HarnessCommand } from "./translate.js";
export { orchestrateInstall } from "./orchestrate.js";
export type { InstallDeps, InstallOutcome, InstallReport } from "./orchestrate.js";
