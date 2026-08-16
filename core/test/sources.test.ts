/**
 * Version source tests — GitHub API & npm registry clients.
 */

import { describe, expect, it, vi } from "vitest";
import { GitHubSource, NpmSource, repoPath } from "../src/index.js";

interface FakeResponse {
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
}

function mockFetch(handler: (url: string, init?: RequestInit) => FakeResponse) {
  return vi.fn(async (url: unknown, init?: unknown) =>
    handler(String(url), init as RequestInit | undefined),
  ) as unknown as typeof fetch;
}

const json = (status: number, body: unknown): FakeResponse => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

describe("GitHubSource", () => {
  it("lists versions from releases with published dates", async () => {
    const fetchImpl = mockFetch((url) => {
      expect(url).toContain("/repos/owner/repo/releases");
      expect(url).toContain("per_page=100");
      return json(200, [
        { tag_name: "v1.0.0", published_at: "2026-01-01T00:00:00Z" },
        { tag_name: "v2.0.0", published_at: "2026-06-01T00:00:00Z" },
      ]);
    });
    const source = new GitHubSource({ fetchImpl, minIntervalMs: 0 });
    const versions = await source.listVersions("owner/repo");
    expect(versions).toEqual([
      { version: "v1.0.0", publishedAt: "2026-01-01T00:00:00Z" },
      { version: "v2.0.0", publishedAt: "2026-06-01T00:00:00Z" },
    ]);
  });

  it("falls back to tags when the repo has no releases", async () => {
    const fetchImpl = mockFetch((url) =>
      url.includes("/releases") ? json(200, []) : json(200, [{ name: "v1.0.0" }, { name: "v1.1.0" }]),
    );
    const source = new GitHubSource({ fetchImpl, minIntervalMs: 0 });
    const versions = await source.listVersions("owner/repo");
    expect(versions).toEqual([{ version: "v1.0.0" }, { version: "v1.1.0" }]);
  });

  it("returns [] for a missing repo instead of throwing", async () => {
    const fetchImpl = mockFetch(() => json(404, {}));
    const source = new GitHubSource({ fetchImpl, minIntervalMs: 0 });
    expect(await source.listVersions("owner/repo")).toEqual([]);
  });

  it("sends user-agent and bearer token headers", async () => {
    const fetchImpl = mockFetch((_url, init) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers["user-agent"]).toContain("dsh-bundler");
      expect(headers["authorization"]).toBe("Bearer sekrit");
      return json(200, [{ tag_name: "v1.0.0", published_at: "2026-01-01T00:00:00Z" }]);
    });
    const source = new GitHubSource({ fetchImpl, token: "sekrit", minIntervalMs: 0 });
    await source.listVersions("owner/repo");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("caches listings — the second call does not hit the network", async () => {
    const fetchImpl = mockFetch(() => json(200, [{ tag_name: "v1.0.0", published_at: "2026-01-01T00:00:00Z" }]));
    const source = new GitHubSource({ fetchImpl, minIntervalMs: 0 });
    await source.listVersions("owner/repo");
    await source.listVersions("owner/repo");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("throws on other HTTP errors", async () => {
    const fetchImpl = mockFetch(() => json(500, {}));
    const source = new GitHubSource({ fetchImpl, minIntervalMs: 0 });
    await expect(source.listVersions("owner/repo")).rejects.toThrow("GitHub API 500");
  });
});

describe("repoPath", () => {
  it("accepts owner/repo", () => expect(repoPath("a/b")).toBe("a/b"));
  it("encodes special characters", () => expect(repoPath("a.b/c-d")).toBe("a.b/c-d"));
  it("rejects malformed ids", () => {
    expect(() => repoPath("no-slash")).toThrow("owner/repo");
    expect(() => repoPath("a/b/c")).toThrow("owner/repo");
  });
});

describe("NpmSource", () => {
  it("lists versions with publication times", async () => {
    const fetchImpl = mockFetch((url) => {
      expect(url).toBe("https://registry.npmjs.org/some-pkg");
      return json(200, {
        versions: { "1.0.0": {}, "1.2.0": {} },
        time: { "1.0.0": "2026-01-01T00:00:00Z", "1.2.0": "2026-03-01T00:00:00Z" },
      });
    });
    const source = new NpmSource({ fetchImpl, minIntervalMs: 0 });
    const versions = await source.listVersions("some-pkg");
    expect(versions).toEqual([
      { version: "1.0.0", publishedAt: "2026-01-01T00:00:00Z" },
      { version: "1.2.0", publishedAt: "2026-03-01T00:00:00Z" },
    ]);
  });

  it("URL-encodes scoped package names", async () => {
    const fetchImpl = mockFetch((url) => {
      expect(url).toBe("https://registry.npmjs.org/%40dsh%2Fplugin-xyz");
      return json(200, { versions: { "1.0.0": {} }, time: {} });
    });
    const source = new NpmSource({ fetchImpl, minIntervalMs: 0 });
    await source.listVersions("@dsh/plugin-xyz");
  });

  it("honors a custom registry base", async () => {
    const fetchImpl = mockFetch((url) => {
      expect(url).toBe("http://localhost:4873/some-pkg");
      return json(200, { versions: { "1.0.0": {} }, time: {} });
    });
    const source = new NpmSource({ registry: "http://localhost:4873", fetchImpl, minIntervalMs: 0 });
    await source.listVersions("some-pkg");
  });

  it("throws on missing packages", async () => {
    const fetchImpl = mockFetch(() => json(404, { error: "Not found" }));
    const source = new NpmSource({ fetchImpl, minIntervalMs: 0 });
    await expect(source.listVersions("ghost-pkg")).rejects.toThrow("package not found");
  });

  it("caches listings — the second call does not hit the network", async () => {
    const fetchImpl = mockFetch(() => json(200, { versions: { "1.0.0": {} }, time: {} }));
    const source = new NpmSource({ fetchImpl, minIntervalMs: 0 });
    await source.listVersions("some-pkg");
    await source.listVersions("some-pkg");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
