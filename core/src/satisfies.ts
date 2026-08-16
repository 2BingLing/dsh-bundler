/**
 * Idempotency helper (SPEC §7.4): decide whether an installed version
 * satisfies an entry's version spec, without network lookups.
 *
 *   latest  → always satisfied (already installed is enough)
 *   range   → semver.satisfies against the installed version
 *   date    → cannot be proven from the installed version alone → not satisfied
 *   commit  → cannot be proven → not satisfied
 */

import semver from "semver";
import { classifyVersionSpec, parseSemver } from "./resolve.js";

export function satisfiesInstalled(installed: string, spec: string | undefined): boolean {
  const kind = classifyVersionSpec(spec);
  if (kind === "latest") return true;
  if (kind === "range") {
    const version = parseSemver(installed);
    return version !== null && semver.satisfies(version, spec!);
  }
  // date anchors and commit pins need authoritative lookup — treat as
  // unsatisfied so the orchestrator reinstalls (or the runner skips).
  return false;
}
