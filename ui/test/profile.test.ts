/**
 * Profile access tests.
 */

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listInstalled, readProfileManifest, resolveDshHome, resolveProfileDir } from "../src/profile.js";

let home: string;

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "dsh-bundler-test-"));
});

afterEach(async () => {
  await import("node:fs/promises").then((fs) => fs.rm(home, { recursive: true, force: true }));
});

describe("resolveDshHome", () => {
  it("honors DSH_HOME", () => {
    expect(resolveDshHome({ DSH_HOME: "C:/custom" } as NodeJS.ProcessEnv)).toBe("C:/custom");
  });
  it("defaults to ~/.dsh", () => {
    expect(resolveDshHome({} as NodeJS.ProcessEnv)).toMatch(/\.dsh$/);
  });
});

describe("resolveProfileDir", () => {
  it("places profiles under $DSH_HOME/profiles", () => {
    expect(resolveProfileDir("web", "C:/home")).toBe(join("C:/home", "profiles", "web"));
  });
});

describe("readProfileManifest", () => {
  it("returns null for a missing profile", async () => {
    expect(await readProfileManifest("missing", home)).toBeNull();
  });

  it("reads an existing profile manifest", async () => {
    const dir = join(home, "profiles", "demo");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({
        name: "dsh-profile-demo",
        dependencies: { "dsh-hello-plugin": "link:./hello" },
        dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "dsh-hello-plugin"] } },
      }),
    );
    const manifest = await readProfileManifest("demo", home);
    expect(manifest?.dsh?.profile?.bundles).toEqual(["@deepseek-ai/dsh-base", "dsh-hello-plugin"]);
  });
});

describe("listInstalled", () => {
  it("maps bundles with dependency specs", async () => {
    const dir = join(home, "profiles", "demo");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({
        dependencies: { "dsh-hello-plugin": "^1.2.3" },
        dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "dsh-hello-plugin"] } },
      }),
    );
    const installed = await listInstalled("demo", home);
    expect(installed).toEqual([
      { id: "@deepseek-ai/dsh-base", type: "bundle", installedVersion: undefined },
      { id: "dsh-hello-plugin", type: "bundle", installedVersion: "^1.2.3" },
    ]);
  });

  it("returns [] when the profile is missing", async () => {
    expect(await listInstalled("missing", home)).toEqual([]);
  });
});
