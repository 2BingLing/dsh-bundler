/**
 * Harness runner — executes translated commands (SPEC §7).
 *
 *   ShellCommand      → execFile (dsh CLI; `dsh plugin --profile <p> add ...`)
 *   SkillInstallCommand → file channel: materialize SKILL.md into a skill root
 *                         (`$DSH_HOME/skills/<name>/`), git-cloning the source
 *                         repo when one is given.
 *
 * Executables (`dsh`, `git`) are injected for tests.
 */

import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { HarnessCommand } from "@dsh-bundler/core";
import { resolveDshHome } from "./profile.js";

export interface HarnessRunnerOptions {
  /** dsh binary; defaults to argv[0] from the translated command ("dsh"). */
  dshBin?: string;
  /** Harness home override; defaults to $DSH_HOME / ~/.dsh (skill root = <home>/skills). */
  dshHome?: string;
  /** Skill root; defaults to `$DSH_HOME/skills`. */
  skillRoot?: string;
  /** Environment for resolving DSH_HOME. */
  env?: NodeJS.ProcessEnv;
  /** Test seam. */
  execFileImpl?: typeof execFile;
}

const COMMIT_RE = /^[0-9a-f]{40}$/i;

/** execFile wrapped as a promise (avoids promisify's overload noise). */
function execAsync(
  exec: typeof execFile,
  bin: string,
  args: string[],
  options: { timeout?: number } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(bin, args, { timeout: options.timeout }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export function createHarnessRunner(opts: HarnessRunnerOptions = {}) {
  const exec = opts.execFileImpl ?? execFile;

  return async function run(cmd: HarnessCommand): Promise<void> {
    if (cmd.kind === "skill-install") {
      await installSkill(cmd, opts, exec);
      return;
    }
    const [bin, ...args] = cmd.argv;
    await execAsync(exec, opts.dshBin ?? bin ?? "dsh", args, { timeout: 180_000 });
  };
}

async function installSkill(
  cmd: Extract<HarnessCommand, { kind: "skill-install" }>,
  opts: HarnessRunnerOptions,
  exec: typeof execFile,
): Promise<void> {
  const root = opts.skillRoot ?? join(resolveDshHome(opts.env), "skills");
  const dir = join(root, cmd.name);
  await mkdir(dir, { recursive: true });

  if (!cmd.source) {
    throw new Error(`skill "${cmd.name}" has no source (v0.1: skills need a git source)`);
  }
  const url = `https://github.com/${cmd.source}`;
  if (cmd.version && COMMIT_RE.test(cmd.version)) {
    await execAsync(exec, "git", ["init", dir]);
    await execAsync(exec, "git", ["-C", dir, "remote", "add", "origin", url]);
    await execAsync(exec, "git", ["-C", dir, "fetch", "--depth", "1", "origin", cmd.version]);
    await execAsync(exec, "git", ["-C", dir, "checkout", "FETCH_HEAD"]);
  } else {
    await execAsync(exec, "git", ["clone", "--depth", "1", url, dir]);
  }
  if (!existsSync(join(dir, "SKILL.md"))) {
    await rm(dir, { recursive: true, force: true });
    throw new Error(`repo ${cmd.source} has no SKILL.md at its root`);
  }
  await rm(join(dir, ".git"), { recursive: true, force: true });
}
