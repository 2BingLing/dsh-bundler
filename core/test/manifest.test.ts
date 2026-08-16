/**
 * Manifest parse/validate tests — SPEC §4 + forward-compat laws §5.
 */

import { describe, expect, it } from "vitest";
import { KIND, SCHEMA_VERSION, parseManifest, validateManifest } from "../src/index.js";

const validPack = {
  schemaVersion: SCHEMA_VERSION,
  kind: KIND,
  name: "Translation Workbench",
  description: "One-click translation stack",
  author: "2BingLing",
  plugins: [
    { id: "@dsh/plugin-glossary", type: "bundle", version: ">=1.2.0" },
    { id: "owner/translation-ui", type: "git", version: "#a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0" },
    { id: "translation-workflow", type: "skill", version: "latest" },
  ],
  config: {},
  ext: {},
};

describe("parseManifest", () => {
  it("parses a valid pack without errors or warnings", () => {
    const result = parseManifest(JSON.stringify(validPack));
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.manifest).not.toBeNull();
    expect(result.manifest?.name).toBe("Translation Workbench");
  });

  it("reports invalid JSON as an error", () => {
    const result = parseManifest("{ not json");
    expect(result.manifest).toBeNull();
    expect(result.errors[0]?.code).toBe("invalid-json");
  });

  it("reports a top-level array as an error", () => {
    const result = validateManifest([1, 2, 3]);
    expect(result.manifest).toBeNull();
    expect(result.errors[0]?.code).toBe("entry-syntax");
  });
});

describe("validateManifest — hard errors", () => {
  it("rejects a wrong kind", () => {
    const result = validateManifest({ ...validPack, kind: "dsh.bundle" });
    expect(result.manifest).toBeNull();
    expect(result.errors.some((e) => e.code === "kind")).toBe(true);
  });

  it("rejects a missing schemaVersion", () => {
    const { schemaVersion: _drop, ...rest } = validPack;
    const result = validateManifest(rest);
    expect(result.manifest).toBeNull();
    expect(result.errors.some((e) => e.code === "schema-version")).toBe(true);
  });

  it("rejects an unsupported (newer) schemaVersion instead of mis-parsing (law 3)", () => {
    const result = validateManifest({ ...validPack, schemaVersion: 2 });
    expect(result.manifest).toBeNull();
    expect(result.errors.some((e) => e.code === "schema-version")).toBe(true);
  });

  it("rejects a missing name", () => {
    const { name: _drop, ...rest } = validPack;
    const result = validateManifest(rest);
    expect(result.manifest).toBeNull();
    expect(result.errors.some((e) => e.code === "missing-field")).toBe(true);
  });

  it("rejects missing plugins", () => {
    const { plugins: _drop, ...rest } = validPack;
    const result = validateManifest(rest);
    expect(result.manifest).toBeNull();
    expect(result.errors.some((e) => e.code === "missing-field")).toBe(true);
  });

  it("rejects an entry without an id", () => {
    const result = validateManifest({
      ...validPack,
      plugins: [{ type: "skill" }],
    });
    expect(result.manifest).toBeNull();
    expect(result.errors.some((e) => e.code === "entry-syntax")).toBe(true);
  });

  it("rejects a non-string version", () => {
    const result = validateManifest({
      ...validPack,
      plugins: [{ id: "a/b", type: "skill", version: 1.2 }],
    });
    expect(result.manifest).toBeNull();
    expect(result.errors.some((e) => e.code === "entry-syntax")).toBe(true);
  });
});

describe("validateManifest — forward compatibility (laws 1 & 2)", () => {
  it("ignores and preserves unknown top-level fields (law 1)", () => {
    const result = validateManifest({ ...validPack, someFutureField: { nested: true } });
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.code === "unknown-field")).toBe(true);
    expect(result.manifest?.someFutureField).toEqual({ nested: true });
  });

  it("warns on unknown entry types but keeps the pack valid (law 2)", () => {
    const result = validateManifest({
      ...validPack,
      plugins: [{ id: "owner/fancy", type: "hyperdrive", version: "latest" }],
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.code === "unknown-entry-type")).toBe(true);
    expect(result.manifest?.plugins[0]?.type).toBe("hyperdrive");
  });

  it("preserves unknown entry fields verbatim (law 1)", () => {
    const result = validateManifest({
      ...validPack,
      plugins: [{ id: "a/b", type: "skill", version: "latest", futureFlag: 42 }],
    });
    expect(result.errors).toEqual([]);
    expect(result.manifest?.plugins[0]?.futureFlag).toBe(42);
  });

  it("defaults missing version to latest", () => {
    const result = validateManifest({
      ...validPack,
      plugins: [{ id: "a/b", type: "skill" }],
    });
    expect(result.manifest?.plugins[0]?.version).toBe("latest");
  });
});

describe("validateManifest — version spec recognition", () => {
  const cases: Array<[string, boolean]> = [
    ["latest", true],
    ["*", true],
    [">=1.2.0", true],
    ["^1.2.0", true],
    ["~1.2", true],
    ["1.x", true],
    ["1.2.3", true],
    ["2026-08-15", true],
    ["a".repeat(40), true],
    ["A".repeat(40), true],
    ["not a version", false],
    ["v1.2.3", false],
  ];

  it.each(cases)("recognizes %s -> %s", (spec, expected) => {
    const result = validateManifest({
      ...validPack,
      plugins: [{ id: "a/b", type: "skill", version: spec }],
    });
    const warned = result.warnings.some((w) => w.code === "unknown-version-spec");
    expect(warned).toBe(!expected);
  });
});

describe("validateManifest — passthrough blocks", () => {
  it("passes config and ext through verbatim without validation", () => {
    const config = { any: { thing: ["goes"] } };
    const ext = { "my-namespace": { note: "ignored by consumers" } };
    const result = validateManifest({ ...validPack, config, ext });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.manifest?.config).toEqual(config);
    expect(result.manifest?.ext).toEqual(ext);
  });
});
