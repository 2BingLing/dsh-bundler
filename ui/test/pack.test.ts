/**
 * Pack data flow tests.
 */

import { describe, expect, it } from "vitest";
import { buildPack, normalizeInstalledVersion, serializePack } from "../src/pack.js";
import type { InstalledPlugin } from "../src/profile.js";

const installed: InstalledPlugin[] = [
  { id: "@dsh/plugin-glossary", type: "bundle", installedVersion: "^1.2.0" },
  { id: "owner/translation-ui", type: "bundle", installedVersion: "github:owner/translation-ui#a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0" },
];

describe("buildPack", () => {
  it("writes intent (latest) by default", () => {
    const pack = buildPack(installed, { name: "Translation" });
    expect(pack.schemaVersion).toBe(1);
    expect(pack.kind).toBe("dsh-pack");
    expect(pack.plugins).toEqual([
      { id: "@dsh/plugin-glossary", type: "bundle", version: "latest" },
      { id: "owner/translation-ui", type: "bundle", version: "latest" },
    ]);
  });

  it("records exact installed versions with the current strategy", () => {
    const pack = buildPack(installed, { name: "Translation", versionStrategy: "current" });
    expect(pack.plugins[0]?.version).toBe("1.2.0");
    // non-semver specs (github:/link:) fall back to latest
    expect(pack.plugins[1]?.version).toBe("latest");
  });

  it("carries description and author when given", () => {
    const pack = buildPack([], { name: "Minimal", description: "desc", author: "2BingLing" });
    expect(pack.description).toBe("desc");
    expect(pack.author).toBe("2BingLing");
  });

  it("handles an empty install list", () => {
    const pack = buildPack([], { name: "Minimal" });
    expect(pack.plugins).toEqual([]);
  });
});

describe("normalizeInstalledVersion", () => {
  it("strips ^ and ~ prefixes", () => {
    expect(normalizeInstalledVersion("^1.2.3")).toBe("1.2.3");
    expect(normalizeInstalledVersion("~1.2.3")).toBe("1.2.3");
    expect(normalizeInstalledVersion("1.2.3")).toBe("1.2.3");
  });
  it("keeps pre-release versions", () => {
    expect(normalizeInstalledVersion("^1.2.3-beta.1")).toBe("1.2.3-beta.1");
  });
  it("falls back to latest for non-semver specs", () => {
    expect(normalizeInstalledVersion("link:../plugin")).toBe("latest");
    expect(normalizeInstalledVersion("github:owner/repo#abc")).toBe("latest");
    expect(normalizeInstalledVersion("file:./plugin")).toBe("latest");
  });
});

describe("serializePack", () => {
  it("serializes with 2-space indent and a trailing newline", () => {
    const text = serializePack(buildPack([], { name: "Minimal" }));
    expect(text).toBe('{\n  "schemaVersion": 1,\n  "kind": "dsh-pack",\n  "name": "Minimal",\n  "plugins": [],\n  "config": {},\n  "ext": {}\n}\n');
  });
});
