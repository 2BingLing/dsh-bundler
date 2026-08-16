/**
 * Translation layer tests — SPEC law 4 (single isolation point for commands).
 */

import { describe, expect, it } from "vitest";
import { translateEntry } from "../src/index.js";
import type { PackEntry, ResolvedEntry } from "../src/index.js";

const resolved = (entry: PackEntry, version = "1.2.3"): ResolvedEntry => ({
  entry,
  status: "ok",
  resolvedVersion: version,
});

describe("translateEntry", () => {
  it("bundle entries map to dsh plugin add with the default profile", () => {
    const entry: PackEntry = { id: "@dsh/plugin-xyz", type: "bundle", version: "latest" };
    const cmds = translateEntry(entry, resolved(entry));
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({
      argv: ["dsh", "plugin", "--profile", "default", "add", "@dsh/plugin-xyz"],
      profile: "default",
    });
  });

  it("git entries install via github: spec", () => {
    const entry: PackEntry = { id: "owner/awesome-plugin", type: "git", version: "latest" };
    const cmds = translateEntry(entry, resolved(entry));
    expect(cmds[0]?.argv).toEqual(["dsh", "plugin", "--profile", "default", "add", "github:owner/awesome-plugin"]);
  });

  it("git commit pins ride on the git spec after #", () => {
    const sha = "a".repeat(40);
    const entry: PackEntry = { id: "owner/awesome-plugin", type: "git", version: `#${sha}` };
    const cmds = translateEntry(entry, resolved(entry, sha));
    expect(cmds[0]?.argv).toEqual(["dsh", "plugin", "--profile", "default", "add", `github:owner/awesome-plugin#${sha}`]);
  });

  it("skill entries emit a file-channel instruction, not a shell command", () => {
    const entry: PackEntry = { id: "translation-workflow", type: "skill", version: "latest" };
    const cmds = translateEntry(entry, resolved(entry, "latest"));
    expect(cmds).toEqual([{ kind: "skill-install", name: "translation-workflow", source: undefined, version: "latest" }]);
  });

  it("skill entries carry the optional git source field", () => {
    const entry = { id: "translation-workflow", type: "skill", version: "latest", source: "owner/skill-repo" } as PackEntry;
    const cmds = translateEntry(entry, resolved(entry));
    expect(cmds[0]).toMatchObject({ kind: "skill-install", name: "translation-workflow", source: "owner/skill-repo" });
  });

  it("uses the configured profile for argv and the command field", () => {
    const entry: PackEntry = { id: "npm-pkg", type: "bundle", version: "latest" };
    const cmds = translateEntry(entry, resolved(entry), { profile: "web" });
    expect(cmds[0]?.argv).toEqual(["dsh", "plugin", "--profile", "web", "add", "npm-pkg"]);
    expect(cmds[0]?.profile).toBe("web");
  });

  it("templates support {id}, {version} and {profile} placeholders", () => {
    const entry: PackEntry = { id: "a/b", type: "bundle", version: "latest" };
    const cmds = translateEntry(entry, resolved(entry, "2.0.0"), {
      profile: "web",
      templates: { bundle: ["dsh", "install", "{id}@{version}", "--profile", "{profile}"] },
    });
    expect(cmds[0]?.argv).toEqual(["dsh", "install", "a/b@2.0.0", "--profile", "web"]);
  });

  it("returns [] for unknown types (defensive — resolver skips them upstream)", () => {
    const entry = { id: "x", type: "hyperdrive", version: "latest" } as PackEntry;
    expect(translateEntry(entry, resolved(entry))).toEqual([]);
  });

  it("returns [] when type is missing", () => {
    const entry = { id: "x", version: "latest" } as PackEntry;
    expect(translateEntry(entry, resolved(entry))).toEqual([]);
  });
});
