/**
 * npm registry version source — used for `cordis` and `bundle` entries
 * (npm package names / bundle ids published as packages).
 *
 * Reads the full packument (versions + time map) so date anchors work.
 */

import { RateLimiter } from "./rate-limit.js";
import { TtlCache } from "./cache.js";
import type { VersionInfo, VersionSource } from "./types.js";

const DEFAULT_REGISTRY = "https://registry.npmjs.org";

export interface NpmSourceOptions {
  /** Registry base URL. Default: https://registry.npmjs.org */
  registry?: string;
  /** Minimum interval between requests. Default: 100ms (registry is lenient). */
  minIntervalMs?: number;
  /** Listings cache TTL. Default: 5 minutes. */
  cacheTtlMs?: number;
  /** Test seam. */
  fetchImpl?: typeof fetch;
}

export class NpmSource implements VersionSource {
  private limiter: RateLimiter;
  private cache: TtlCache<VersionInfo[]>;

  constructor(private opts: NpmSourceOptions = {}) {
    this.limiter = new RateLimiter(opts.minIntervalMs ?? 100);
    this.cache = new TtlCache(opts.cacheTtlMs);
  }

  async listVersions(id: string): Promise<VersionInfo[]> {
    const cached = this.cache.get(id);
    if (cached) return cached;

    const registry = this.opts.registry ?? DEFAULT_REGISTRY;
    const url = `${registry}/${encodeURIComponent(id)}`;
    await this.limiter.acquire();
    const fetchImpl = this.opts.fetchImpl ?? fetch;
    const res = await fetchImpl(url, {
      headers: { accept: "application/vnd.npm.install-v1+json" },
    });
    if (res.status === 404) {
      throw new Error(`package not found on npm registry: ${id}`);
    }
    if (!res.ok) {
      throw new Error(`npm registry ${res.status} for ${id}`);
    }
    const data = (await res.json()) as {
      versions?: Record<string, unknown>;
      time?: Record<string, string>;
    };
    const versions: VersionInfo[] = [];
    for (const version of Object.keys(data.versions ?? {})) {
      versions.push({ version, publishedAt: data.time?.[version] });
    }
    this.cache.set(id, versions);
    return versions;
  }
}
