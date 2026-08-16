/**
 * Version source abstraction — resolve.ts asks a source for the version
 * history of an id; the source decides how to obtain it (GitHub API, npm
 * registry, or a test double).
 */

/** One published version of a plugin. */
export interface VersionInfo {
  version: string;
  /** ISO timestamp when this version was published, when the source knows it. */
  publishedAt?: string;
}

export interface VersionSource {
  /** List known versions of `id` (newest first not guaranteed). */
  listVersions(id: string): Promise<VersionInfo[]>;
}
