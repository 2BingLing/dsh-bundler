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
  it("skill entries use the default skill template", () => {
    const entry: PackEntry = { id: "owner/awesome-skill", type: "skill", version: "latest" };
    const cmds = translateEntry(entry, resolved(entry));
    expect(cmds).toHaveLength(1);
    expect(cmds[0]?.argv).toEqual(["dsh", "plugin", "add", "--type", "skill", "owner/awesome-skill"]);
  });

  it("cordis entries map to dsh plugin add", () => {
    const entry: PackEntry = { id: "@dsh/plugin-xyz", type: "cordis", version: "latest" };
    const cmds = translateEntry(entry, resolved(entry));
    expect(cmds[0]?.argv).toEqual(["dsh", "plugin", "add", "@dsh/plugin-xyz"]);
  });

  it("bundle entries map to dsh plugin add", () => {
    const entry: PackEntry = { id: "dsh-plugin-tm", type: "bundle", version: "latest" };
    const cmds = translateEntry(entry, resolved(entry));
    expect(cmds[0]?.argv).toEqual(["dsh", "plugin", "add", "dsh-plugin-tm"]);
  });

  it("templates support {id} and {version} placeholders", () => {
    const entry: PackEntry = { id: "a/b", type: "skill", version: "latest" };
    const cmds = translateEntry(entry, resolved(entry, "2.0.0"), {
      templates: { skill: ["dsh", "install", "{id}@{version}"] },
    });
    expect(cmds[0]?.argv).toEqual(["dsh", "install", "a/b@2.0.0"]);
  });

  it("carries the profile as a separate field for the runner", () => {
    const entry: PackEntry = { id: "npm-pkg", type: "cordis", version: "latest" };
    const cmds = translateEntry(entry, resolved(entry), { profile: "web" });
    expect(cmds[0]?.profile).toBe("web");
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
