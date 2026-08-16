/**
 * dsh-bundler ui — harness plugin (cordis), Settings-button entry.
 *
 * Architecture (SPEC §7 / design doc §5):
 *   - Settings entry only — NOT a sidebar entry.
 *   - Pack page: select installed plugins → version strategy → export dsh.pack.json.
 *   - Install page: paste/import JSON → one-click install → report.
 *
 * This plugin is a thin shell: all logic lives in @dsh-bundler/core
 * (pure Node, zero DSH deps). Cordis wiring, page components, and i18n
 * (zh/en, following the harness locale) land in M2.
 */

/** Harness plugin name. */
export const name = "dsh-bundler";

// TODO(M2): register the Settings entry and mount pack/install pages.
// import { Context } from "cordis";
// import * as core from "@dsh-bundler/core";
//
// export function apply(ctx: Context) {
//   // Settings button entry per design doc §5
// }
