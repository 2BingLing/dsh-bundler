/**
 * dsh-bundler — browser half. Registers the settings section into the
 * official `settings.section` slot and binds the `dsh-bundler` settings
 * namespace through the `settingsScope` service (official ui-theme pattern).
 *
 * Type note: settingsScope/locale service types are declared locally in
 * vendor.d.ts (official shapes copied from source) because the DSH client
 * runtime packages are not fully published to npm yet.
 *
 * Export discipline: only what cordis loading needs — `apply` / `inject`.
 */

import type {} from '@deepseek-ai/dsh-client-ui-slots';
import type { ClientContext } from './vendor.js';
import { DSH_BUNDLER_SETTINGS_NAMESPACE, type BundlerConfig } from '../settings.js';
import { PackSettings, type PackSettingsInjected } from './PackSettings.js';
import { en, zh, type BundlerKey } from './locales.js';

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Settings-section copy owned by this plugin. */
    'dsh-bundler': BundlerKey;
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'dsh-bundler';

/**
 * Required services: settings transport (settingsScope), slots/locale for the
 * section row, connection/remote for settings invalidation forwarding.
 */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope'];

/**
 * Register the dsh-bundler settings section once its slot is on the ledger.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-bundler: dictionaries');

  const host = ctx.settingsScope.bind<BundlerConfig>({ namespace: DSH_BUNDLER_SETTINGS_NAMESPACE });
  const injected = (): PackSettingsInjected => ({
    snapshot: () => host.getSnapshot(),
    setField: (field, value) => host.set(field, value),
  });

  const t = ctx.locale.bind(NS);
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-bundler',
    order: 50,
    label: () => t('section.nav'),
    locale: NS,
    inject: injected,
  }, PackSettings));
}
