// @vitest-environment jsdom
/**
 * PackSettings component tests — props fed directly (official testing
 * pattern); assert user-visible behavior.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PackSettings, type PackSettingsProps } from '../src/client/PackSettings.js';
import { en } from '../src/client/locales.js';

afterEach(cleanup);

const t = (key: string) => en[key as keyof typeof en] ?? key;

function makeProps(overrides: Partial<PackSettingsProps> = {}): PackSettingsProps {
  return {
    t,
    snapshot: () => ({
      status: 'ready',
      value: { profile: 'web', dshBin: 'dsh' },
      base: undefined,
      user: undefined,
      revision: 1,
      writable: true,
      mode: 'host',
    }),
    setField: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('PackSettings', () => {
  it('renders the section title, fields and command guide', () => {
    render(<PackSettings {...makeProps()} />);
    expect(screen.getByText('dsh-bundler')).toBeTruthy();
    expect(screen.getByTestId('profile-input')).toHaveProperty('value', 'web');
    expect(screen.getByTestId('dshbin-input')).toHaveProperty('value', 'dsh');
    expect(screen.getByText(en['commands.pack'])).toBeTruthy();
    expect(screen.getByText(en['commands.install'])).toBeTruthy();
  });

  it('commits field edits on blur', () => {
    const setField = vi.fn(async () => {});
    render(<PackSettings {...makeProps({ setField })} />);
    const input = screen.getByTestId('profile-input');
    fireEvent.blur(input, { target: { value: 'headless' } });
    expect(setField).toHaveBeenCalledWith('profile', 'headless');
  });

  it('does not write when read-only', () => {
    const setField = vi.fn(async () => {});
    render(
      <PackSettings {...makeProps({ setField, snapshot: () => ({
        status: 'ready',
        value: { profile: 'web', dshBin: 'dsh' },
        base: undefined,
        user: undefined,
        revision: 1,
        writable: false,
        mode: 'host',
      }) })} />,
    );
    fireEvent.blur(screen.getByTestId('profile-input'), { target: { value: 'headless' } });
    expect(setField).not.toHaveBeenCalled();
    expect(screen.getByText(/read-only/)).toBeTruthy();
  });

  it('shows the loading status', () => {
    render(
      <PackSettings {...makeProps({ snapshot: () => ({
        status: 'loading',
        value: undefined,
        base: undefined,
        user: undefined,
        revision: undefined,
        writable: false,
        mode: 'host',
      }) })} />,
    );
    expect(screen.getByText(en['status.loading'])).toBeTruthy();
  });
});
