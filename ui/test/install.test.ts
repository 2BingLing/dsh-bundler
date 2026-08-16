/**
 * Install data flow tests.
 */

import { describe, expect, it } from "vitest";
import { importPack, installPack } from "../src/install.js";
import type { InstallDeps, PackEntry } from "@dsh-bundler/core";

const validPack = JSON.stringify({
  schemaVersion: 1,
  kind: "dsh-pack",
  name: "Translation",
  plugins: [{ id: "@dsh/plugin-glossary", type: "bundle", version: "latest" }],
});

const makeDeps = (): InstallDeps => ({
  resolve: async (entry: PackEntry) => ({ entry, status: "ok", resolvedVersion: "1.0.0" }),
  translate: (entry) => [{ argv: ["dsh", "plugin", "--profile", "default", "add", entry.id] }],
  run: async () => {},
  isSatisfied: async () => false,
  snapshot: async () => ({}),
  restore: async () => {},
});

describe("importPack", () => {
  it("accepts a valid pack", () => {
    const result = importPack(validPack);
    expect(result.phase).toBe("ok");
    expect(result.errors).toEqual([]);
    expect(result.manifest).not.toBeNull();
  });

  it("rejects invalid JSON", () => {
    const result = importPack("{ not json");
    expect(result.phase).toBe("invalid");
    expect(result.errors[0]?.code).toBe("invalid-json");
    expect(result.manifest).toBeNull();
  });

  it("rejects schema-invalid packs", () => {
    const result = importPack(JSON.stringify({ schemaVersion: 1, kind: "dsh-pack", name: "x" }));
    expect(result.phase).toBe("invalid");
    expect(result.errors.some((e) => e.code === "missing-field")).toBe(true);
  });
});

describe("installPack", () => {
  it("installs a valid pack and returns the report", async () => {
    const outcome = await installPack(validPack, makeDeps());
    expect(outcome.import.phase).toBe("ok");
    expect(outcome.report?.summary).toEqual({ installed: 1, skipped: 0, failed: 0 });
  });

  it("does not orchestrate invalid packs", async () => {
    const outcome = await installPack("not json", makeDeps());
    expect(outcome.report).toBeUndefined();
    expect(outcome.import.phase).toBe("invalid");
  });
});
