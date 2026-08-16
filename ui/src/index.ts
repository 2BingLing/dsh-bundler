/**
 * dsh-bundler — harness plugin (cordis), M2.
 *
 * Wiring (aligned with official DSH source 2026-08-16):
 *   - a function plugin: named exports `name` / `inject` / `Config` / `apply`,
 *     no default export;
 *   - `installSettingsSection` (from @deepseek-ai/dsh-settings) makes the
 *     plugin's configuration editable on configuration surfaces;
 *   - two slash commands (`ctx.commands.register`) drive pack & install;
 *   - all logic lives in @dsh-bundler/core (pure Node, zero DSH deps); this
 *     package only wires core + the harness runner.
 *
 * i18n (zh/en) follows the harness locale via DSH_LOCALE / LANG.
 */

import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import type { CommandInvocation, CommandResult } from "@deepseek-ai/dsh-commands";
import {
  resolveEntry,
  satisfiesInstalled,
  translateEntry,
  type InstallDeps,
} from "@dsh-bundler/core";
import { createHarnessRunner } from "./runner.js";
import { listInstalled, readProfileManifest, type ProfileManifest } from "./profile.js";
import { buildPack, serializePack } from "./pack.js";
import { installPack } from "./install.js";
import { detectLocale, messages } from "./i18n.js";
import { DSH_BUNDLER_SETTINGS_NAMESPACE, type BundlerConfig } from "./settings.js";

/** Cordis plugin name used by loader diagnostics. */
export const name = "dsh-bundler";

/** Services this plugin injects: the commands registry and user settings. */
export const inject = ["commands", "settings"] as const;

/** Plugin configuration (schema-editable fields carry defaults). */
export interface Config extends BundlerConfig {
  /** Harness home override; defaults to $DSH_HOME / ~/.dsh. */
  dshHome?: string;
  /** UI language; defaults to the harness locale. */
  locale?: "zh" | "en";
}

/** Schema for configuration surfaces; optional fields (dshHome/locale) stay out. */
export const Config: z<Config> = z.object({
  profile: z.string().default("default"),
  dshBin: z.string().default("dsh"),
});

/** Register settings, commands, and the core wiring. */
export function apply(ctx: Context, config: Config): void {
  let current: () => Config = () => config;
  installSettingsSection(
    ctx,
    settingsNamespace(DSH_BUNDLER_SETTINGS_NAMESPACE),
    Config,
    config,
    {
      setSource: (source) => {
        current = source;
      },
      onChange: () => {},
    },
  );

  const msg = messages(config.locale ?? detectLocale());
  const runner = createHarnessRunner({ dshBin: config.dshBin, dshHome: config.dshHome });

  /** Core orchestration deps, bound to the current config. */
  const deps: InstallDeps = {
    resolve: (entry) => resolveEntry(entry, {}),
    translate: (entry, resolved) => translateEntry(entry, resolved, { profile: current().profile }),
    run: runner,
    // Idempotency (SPEC §7.4): already installed and satisfying the spec → skip.
    isSatisfied: async (entry, resolved) => {
      const manifest = await readProfileManifest(current().profile, current().dshHome);
      if (!manifest?.dsh?.profile?.bundles?.includes(entry.id)) return false;
      const installed = manifest.dependencies?.[entry.id];
      if (installed === undefined) return false;
      return satisfiesInstalled(installed, resolved.resolvedVersion ?? entry.version);
    },
    // Snapshot the profile manifest before installing; restore removes the
    // dependencies this install added (SPEC §7: roll back only this install's
    // changes).
    snapshot: async () => readProfileManifest(current().profile, current().dshHome),
    restore: async (snapshot) => {
      const before = snapshot as ProfileManifest | null;
      const after = await readProfileManifest(current().profile, current().dshHome);
      const added = Object.keys(after?.dependencies ?? {}).filter(
        (dep) => before?.dependencies?.[dep] === undefined,
      );
      for (const dep of added) {
        await runner({
          argv: ["dsh", "plugin", "--profile", current().profile, "remove", dep],
          profile: current().profile,
        });
      }
    },
  };

  ctx.commands.register({
    name: msg.packCommandName,
    description: msg.packCommandDescription,
    handler: async (): Promise<CommandResult> => {
      const installed = await listInstalled(current().profile, current().dshHome);
      if (installed.length === 0) {
        return { kind: "success", text: msg.packEmpty };
      }
      const pack = buildPack(installed, { name: `${current().profile} profile` });
      return { kind: "success", text: serializePack(pack) };
    },
  });

  ctx.commands.register({
    name: msg.installCommandName,
    description: msg.installCommandDescription,
    handler: async (invocation: CommandInvocation): Promise<CommandResult> => {
      const outcome = await installPack(invocation.rawInput, deps);
      if (outcome.report === undefined) {
        const detail = outcome.import.errors.map((e) => e.message).join("; ");
        return { kind: "error", text: `${msg.installInvalid}: ${detail}` };
      }
      const { report } = outcome;
      const lines = report.results.map((r) => `- ${r.entryId}: ${r.status}${r.detail ? ` (${r.detail})` : ""}`);
      const summary = `installed ${report.summary.installed}, skipped ${report.summary.skipped}, failed ${report.summary.failed}`;
      if (report.summary.failed > 0) {
        return { kind: "error", text: `${msg.installFailed}. ${summary}\n${lines.join("\n")}` };
      }
      return { kind: "success", text: `${msg.installOk}: ${summary}\n${lines.join("\n")}` };
    },
  });
}
