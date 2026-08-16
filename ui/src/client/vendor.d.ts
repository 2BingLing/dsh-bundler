/**
 * Type stand-ins for DSH client services whose npm packages are not fully
 * published (2026-08-16: @deepseek-ai/dsh-client-runtime's dependency chain
 * 404s on the registry, so runtime/locale/ui-settings cannot install).
 *
 * Shapes are copied verbatim from the official source:
 *   - packages/client/runtime/src/client/contract/settings-scope.ts
 *   - packages/client/ui-settings/src/client/settings-scope.ts (bind)
 *   - packages/client/ui-user-questions/src/client/index.ts (locale.register/bind)
 *
 * Drift risk: if the official shapes change, update these declarations.
 * At runtime these services come from the DSH web shell's module table;
 * the npm installability gap does not affect the running harness.
 */

import type { Context } from '@deepseek-ai/cordis';

/** Client-side sync state of one settings namespace (official copy). */
export interface SettingsScopeSnapshot<T> {
  status: 'loading' | 'ready' | 'unavailable';
  value: T | undefined;
  base: unknown;
  user: unknown;
  revision: number | undefined;
  writable: boolean;
  mode: 'host' | 'memory';
}

/** Domain-owned description of one settings namespace (official copy). */
export interface SettingsScopeSpec<T> {
  namespace: string;
  decode?: (section: unknown) => T | undefined;
}

/** Reactive owner handle over one namespace's durable section (official copy). */
export interface SettingsScope<T> {
  getSnapshot(): SettingsScopeSnapshot<T>;
  subscribe(listener: () => void): () => void;
  set(field: string, value: unknown): Promise<void>;
  unset(field: string): Promise<void>;
}

/** settingsScope service (official copy: SettingsScopeBinder.bind). */
export interface SettingsScopeBinder {
  bind<T>(spec: SettingsScopeSpec<T>): SettingsScope<T>;
}

/** locale service (official usage: register(ns, { zh, en }), bind(ns) → t). */
export interface LocaleDictionaries {
  zh: Record<string, string>;
  en: Record<string, string>;
}
export interface LocaleService {
  /** Register a dictionary; returns the disposer (official effect pattern). */
  register(namespace: string, dictionaries: LocaleDictionaries): () => void;
  bind(namespace: string): (key: string) => string;
}

/** slots service (official usage: register({name, id?, order?, label?, locale?, inject?}, Component)). */
export interface SlotRegistrationOptions {
  name: string;
  id?: string;
  order?: number;
  label?: string | (() => string);
  locale?: string;
  children?: Record<string, unknown>;
  store?: unknown;
  inject?: () => unknown;
}
export interface SlotsService {
  register(options: SlotRegistrationOptions, component: unknown): () => void;
  /** Wait for the named slot declaration, then register (official pattern). */
  inject(name: string, factory: () => () => void): void;
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    settingsScope: SettingsScopeBinder;
    locale: LocaleService;
    slots: SlotsService;
  }
}

export type ClientContext = Context;
