/**
 * Client dictionaries (zh/en) — the bilingual policy on the settings surface.
 */

export const en = {
  'section.nav': 'dsh-bundler',
  'section.title': 'dsh-bundler',
  'section.hint': 'Pack & install DSH plugin packs (dsh.pack.json) for this profile.',
  'profile.label': 'Profile',
  'profile.hint': 'Target profile for pack/install.',
  'dshBin.label': 'dsh binary',
  'dshBin.hint': 'Command used to run the harness CLI.',
  'commands.title': 'Commands',
  'commands.pack': '/dsh-bundler-pack — export the profile\'s installed plugins as dsh.pack.json',
  'commands.install': '/dsh-bundler-install <json> — validate and install a dsh.pack.json',
  'status.ready': 'loaded',
  'status.loading': 'loading…',
  'status.unavailable': 'settings unavailable',
  'status.readonly': 'read-only',
} as const;

export const zh = {
  'section.nav': 'dsh-bundler',
  'section.title': 'dsh-bundler',
  'section.hint': '为当前 profile 打包与安装 DSH 插件整合包（dsh.pack.json）。',
  'profile.label': 'Profile',
  'profile.hint': '打包/安装的目标 profile。',
  'dshBin.label': 'dsh 可执行文件',
  'dshBin.hint': '运行 harness CLI 的命令。',
  'commands.title': '命令',
  'commands.pack': '/dsh-bundler-pack —— 把当前 profile 已装插件导出为 dsh.pack.json',
  'commands.install': '/dsh-bundler-install <json> —— 校验并安装 dsh.pack.json',
  'status.ready': '已加载',
  'status.loading': '加载中…',
  'status.unavailable': '设置不可用',
  'status.readonly': '只读',
} as const;

export type BundlerKey = keyof typeof en;
