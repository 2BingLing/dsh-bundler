/**
 * dsh-bundler settings section (browser half): a `settings.section` row that
 * shows the pack/install configuration and the slash commands. Reads/writes go
 * through the injected settings scope (official `settingsScope` service) —
 * components never touch ctx.
 */

import { useState } from 'react';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { SettingsScopeSnapshot } from './vendor.js';
import type { BundlerConfig } from '../settings.js';
import type { BundlerKey } from './locales.js';

/** Injected business face: the settings scope read/write pair. */
export interface PackSettingsInjected {
  /** Latest snapshot of the dsh-bundler settings section. */
  snapshot: () => SettingsScopeSnapshot<BundlerConfig>;
  /** Queue one scalar field write. */
  setField: (field: keyof BundlerConfig, value: string) => Promise<void>;
}

/** Full component props: locale seat + injected face. */
export type PackSettingsProps = PropsLocale<'dsh-bundler'> & PackSettingsInjected;

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '4px 8px',
  borderRadius: 6,
  border: '1px solid var(--dsw-border, #d0d7de)',
  background: 'var(--dsw-input-bg, #ffffff)',
  color: 'var(--dsw-text, #1f2328)',
  font: 'inherit',
};

const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 };

const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600 };

const hintStyle: React.CSSProperties = { fontSize: 12, opacity: 0.7 };

const codeStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
  fontSize: 12,
  background: 'var(--dsw-code-bg, #f6f8fa)',
  borderRadius: 4,
  padding: '1px 5px',
};

const statusStyle: React.CSSProperties = { fontSize: 12, opacity: 0.6, marginTop: 4 };

/**
 * Render the dsh-bundler settings section: profile/dshBin fields and the
 * slash-command guide. Field writes commit on blur; a failed or read-only
 * section renders disabled inputs.
 */
export function PackSettings({ t, snapshot, setField }: PackSettingsProps) {
  const [busy, setBusy] = useState(false);
  const snap = snapshot();
  const value = snap.value ?? { profile: 'default', dshBin: 'dsh' };
  const writable = snap.writable !== false;

  const commit = (field: keyof BundlerConfig) => async (event: React.FocusEvent<HTMLInputElement>) => {
    if (!writable) return;
    setBusy(true);
    try {
      await setField(field, event.target.value);
    } finally {
      setBusy(false);
    }
  };

  const statusText =
    snap.status === 'loading' ? t('status.loading')
      : snap.status === 'unavailable' ? t('status.unavailable')
        : writable ? t('status.ready')
          : `${t('status.ready')} · ${t('status.readonly')}`;

  return (
    <div data-testid="dsh-bundler-settings" style={{ padding: '12px 0' }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t('section.title')}</div>
      <div style={hintStyle}>{t('section.hint')}</div>

      <div style={{ marginTop: 12 }}>
        <div style={fieldStyle}>
          <label htmlFor="dsh-bundler-profile" style={labelStyle}>{t('profile.label')}</label>
          <input
            id="dsh-bundler-profile"
            data-testid="profile-input"
            style={inputStyle}
            defaultValue={value.profile}
            disabled={!writable || busy}
            onBlur={commit('profile')}
          />
          <span style={hintStyle}>{t('profile.hint')}</span>
        </div>

        <div style={fieldStyle}>
          <label htmlFor="dsh-bundler-dshBin" style={labelStyle}>{t('dshBin.label')}</label>
          <input
            id="dsh-bundler-dshBin"
            data-testid="dshbin-input"
            style={inputStyle}
            defaultValue={value.dshBin}
            disabled={!writable || busy}
            onBlur={commit('dshBin')}
          />
          <span style={hintStyle}>{t('dshBin.hint')}</span>
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>{t('commands.title')}</div>
      <ul style={{ margin: '6px 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
        <li><code style={codeStyle}>{t('commands.pack')}</code></li>
        <li><code style={codeStyle}>{t('commands.install')}</code></li>
      </ul>

      <span style={statusStyle} data-testid="status">{statusText}</span>
    </div>
  );
}
