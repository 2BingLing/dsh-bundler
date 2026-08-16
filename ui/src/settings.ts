/**
 * Shared host/client contract: the settings namespace identity and the
 * durable configuration section. This module must stay dependency-free so
 * the browser bundle can inline it safely.
 */

/** Settings namespace owned by the dsh-bundler plugin (plain string, official pattern). */
export const DSH_BUNDLER_SETTINGS_NAMESPACE = 'dsh-bundler';

/** Durable configuration shared by the Host schema and the browser scope. */
export interface BundlerConfig {
  /** Target profile for pack/install. */
  profile: string;
  /** dsh binary. */
  dshBin: string;
}

/** Defaults when the user-settings document has no override. */
export const DEFAULT_BUNDLER_CONFIG: BundlerConfig = {
  profile: 'default',
  dshBin: 'dsh',
};
