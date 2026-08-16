/**
 * GitHub version source — used for `skill` entries (owner/repo).
 *
 * Strategy:
 *   1. releases (tag_name + published_at) — preferred, carries dates;
 *   2. fall back to tags when the repo has no releases (no dates).
 *
 * Rate limiting: anonymous GitHub API is 60 req/h — keep a conservative
 * 1s interval without a token, 200ms with one. All listings are cached
 * (TTL 5 min) so repeated resolutions do not burn quota.
 */

import { RateLimiter } from "./rate-limit.js";
import { TtlCache } from "./cache.js";
import type { VersionInfo, VersionSource } from "./types.js";

const API_BASE = "https://api.github.com";
const MAX_PAGES = 5;
const PER_PAGE = 100;

export interface GitHubSourceOptions {
  /** GitHub token (optional; raises rate limits). */
  token?: string;
  /** Minimum interval between requests. Default: 1000ms anonymous, 200ms with token. */
  minIntervalMs?: number;
  /** Listings cache TTL. Default: 5 minutes. */
  cacheTtlMs?: number;
  /** Test seam. */
  fetchImpl?: typeof fetch;
}

export class GitHubSource implements VersionSource {
  private limiter: RateLimiter;
  private cache: TtlCache<VersionInfo[]>;

  constructor(private opts: GitHubSourceOptions = {}) {
    this.limiter = new RateLimiter(opts.minIntervalMs ?? (opts.token ? 200 : 1000));
    this.cache = new TtlCache(opts.cacheTtlMs);
  }

  async listVersions(id: string): Promise<VersionInfo[]> {
    const cached = this.cache.get(id);
    if (cached) return cached;

    let versions = await this.fetchReleases(id);
    if (versions.length === 0) {
      versions = await this.fetchTags(id);
    }
    this.cache.set(id, versions);
    return versions;
  }

  private async fetchReleases(id: string): Promise<VersionInfo[]> {
    const items = await this.paginate(`/repos/${repoPath(id)}/releases?per_page=${PER_PAGE}`, id);
    return items.map((r) => {
      const tag = r.tag_name;
      const published = r.published_at;
      return {
        version: tag == null ? "" : String(tag),
        publishedAt: published == null ? undefined : String(published),
      };
    }).filter((v) => v.version !== "");
  }

  private async fetchTags(id: string): Promise<VersionInfo[]> {
    const items = await this.paginate(`/repos/${repoPath(id)}/tags?per_page=${PER_PAGE}`, id);
    return items.map((t) => {
      const name = t.name;
      return { version: name == null ? "" : String(name) };
    }).filter((v) => v.version !== "");
  }

  /** Fetch a paginated GitHub endpoint; returns [] on missing repo. */
  private async paginate(path: string, id: string): Promise<Array<Record<string, unknown>>> {
    const out: Array<Record<string, unknown>> = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const sep = path.includes("?") ? "&" : "?";
      const data = await this.apiGet(`${path}${sep}page=${page}`);
      if (!Array.isArray(data)) return out; // repo missing or empty
      out.push(...data);
      if (data.length < PER_PAGE) break;
    }
    void id;
    return out;
  }

  private async apiGet(path: string): Promise<unknown> {
    await this.limiter.acquire();
    const fetchImpl = this.opts.fetchImpl ?? fetch;
    const res = await fetchImpl(`${API_BASE}${path}`, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "dsh-bundler/0.1 (version resolver)",
        ...(this.opts.token ? { authorization: `Bearer ${this.opts.token}` } : {}),
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status} for ${path}`);
    }
    return res.json();
  }
}

/** Split "owner/repo" into an API path segment; throws on malformed ids. */
export function repoPath(id: string): string {
  const parts = id.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`invalid repo id "${id}" (expected owner/repo)`);
  }
  return `${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`;
}
