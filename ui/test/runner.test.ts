/**
 * Harness runner tests — shell commands + skill file channel.
 */

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHarnessRunner } from "../src/runner.js";

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "dsh-bundler-runner-"));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

type ExecCallback = (error: Error | null) => void;

/** execFile stub that records calls and resolves immediately. */
function fakeExecFile(handler: (bin: string, args: string[]) => void | Promise<void>) {
  return vi.fn(async (bin: string, args: string[], _options: unknown, callback: ExecCallback) => {
    try {
      await handler(bin, args);
      callback(null);
    } catch (err) {
      callback(err as Error);
    }
  }) as unknown as typeof execFile;
}

describe("shell commands", () => {
  it("executes the translated argv with the dsh binary", async () => {
    const calls: Array<{ bin: string; args: string[] }> = [];
    const fakeExec = fakeExecFile((bin, args) => {
      calls.push({ bin, args });
    });

    const runner = createHarnessRunner({ execFileImpl: fakeExec });
    await runner({ argv: ["dsh", "plugin", "--profile", "web", "add", "some-pkg"], profile: "web" });

    expect(calls).toEqual([{ bin: "dsh", args: ["plugin", "--profile", "web", "add", "some-pkg"] }]);
  });

  it("allows overriding the dsh binary", async () => {
    const fakeExec = fakeExecFile(() => {});
    const runner = createHarnessRunner({ dshBin: "dsh-dev", execFileImpl: fakeExec });
    await runner({ argv: ["dsh", "plugin", "add", "pkg"] });
    expect(fakeExec).toHaveBeenCalledWith(
      "dsh-dev",
      ["plugin", "add", "pkg"],
      expect.objectContaining({ timeout: 180_000 }),
      expect.any(Function),
    );
  });

  it("propagates command failures", async () => {
    const fakeExec = fakeExecFile(() => {
      throw new Error("install exploded");
    });
    const runner = createHarnessRunner({ execFileImpl: fakeExec });
    await expect(runner({ argv: ["dsh", "plugin", "add", "pkg"] })).rejects.toThrow("install exploded");
  });
});

describe("skill file channel", () => {
  it("clones a source repo into the skill root and strips .git", async () => {
    const skillRoot = join(tmp, "skills");
    const calls: string[][] = [];
    const fakeExec = fakeExecFile(async (_bin, args) => {
      calls.push(args);
      if (args[0] === "clone") {
        // simulate a successful clone of a repo with SKILL.md
        const dir = args.at(-1)!;
        await mkdir(join(dir, ".git"), { recursive: true });
        await writeFile(join(dir, "SKILL.md"), "# skill\n");
      }
    });

    const runner = createHarnessRunner({ skillRoot, execFileImpl: fakeExec });
    await runner({ kind: "skill-install", name: "translation-workflow", source: "owner/skill-repo" });

    expect(calls[0]?.[0]).toBe("clone");
    const { existsSync } = await import("node:fs");
    expect(existsSync(join(skillRoot, "translation-workflow", "SKILL.md"))).toBe(true);
    expect(existsSync(join(skillRoot, "translation-workflow", ".git"))).toBe(false);
  });

  it("rejects skills without a source", async () => {
    const runner = createHarnessRunner({ skillRoot: tmp, execFileImpl: fakeExecFile(() => {}) });
    await expect(runner({ kind: "skill-install", name: "orphan" })).rejects.toThrow("no source");
  });

  it("removes the clone when the repo has no SKILL.md", async () => {
    const fakeExec = fakeExecFile(async (_bin, args) => {
      if (args[0] === "clone") {
        const dir = args.at(-1)!;
        await mkdir(dir, { recursive: true });
      }
    });

    const runner = createHarnessRunner({ skillRoot: tmp, execFileImpl: fakeExec });
    await expect(
      runner({ kind: "skill-install", name: "empty-repo", source: "owner/no-skill" }),
    ).rejects.toThrow("has no SKILL.md");
    const { existsSync } = await import("node:fs");
    expect(existsSync(join(tmp, "empty-repo"))).toBe(false);
  });

  it("pins a commit with init/fetch/checkout", async () => {
    const skillRoot = join(tmp, "skills");
    const sha = "b".repeat(40);
    const calls: string[][] = [];
    const fakeExec = fakeExecFile(async (_bin, args) => {
      calls.push(args);
      if (args[0] === "init") {
        await writeFile(join(args.at(-1)!, "SKILL.md"), "# pinned\n");
      }
    });

    const runner = createHarnessRunner({ skillRoot, execFileImpl: fakeExec });
    await runner({ kind: "skill-install", name: "pinned-skill", source: "owner/repo", version: sha });

    // git -C <dir> <verb> ... → the verb sits after -C
    const verbs = calls.map((c) => (c[0] === "-C" ? c[2]! : c[0]!));
    expect(verbs).toEqual(["init", "remote", "fetch", "checkout"]);
    const { existsSync } = await import("node:fs");
    expect(existsSync(join(skillRoot, "pinned-skill", "SKILL.md"))).toBe(true);
  });
});
