/**
 * i18n strings (zh/en) — the bilingual policy: user-facing copy follows the
 * harness locale. v0.1 ships both languages; the host passes the locale in.
 */

export type Locale = "zh" | "en";

export interface Messages {
  packCommandName: string;
  packCommandDescription: string;
  installCommandName: string;
  installCommandDescription: string;
  packOk: string;
  packEmpty: string;
  installOk: string;
  installInvalid: string;
  installFailed: string;
  skillNoSource: string;
}

const ZH: Messages = {
  packCommandName: "dsh-bundler-pack",
  packCommandDescription: "把当前 profile 已装插件导出为 dsh.pack.json",
  installCommandName: "dsh-bundler-install",
  installCommandDescription: "导入 dsh.pack.json 并一键安装到当前 profile",
  packOk: "已导出 dsh.pack.json",
  packEmpty: "当前 profile 没有已装插件",
  installOk: "安装完成",
  installInvalid: "dsh.pack.json 无效",
  installFailed: "部分条目安装失败",
  skillNoSource: "技能没有来源,无法安装",
};

const EN: Messages = {
  packCommandName: "dsh-bundler-pack",
  packCommandDescription: "Export the current profile's installed plugins as dsh.pack.json",
  installCommandName: "dsh-bundler-install",
  installCommandDescription: "Import a dsh.pack.json and install it into the current profile",
  packOk: "dsh.pack.json exported",
  packEmpty: "no plugins installed in the current profile",
  installOk: "install finished",
  installInvalid: "invalid dsh.pack.json",
  installFailed: "some entries failed to install",
  skillNoSource: "skill has no source and cannot be installed",
};

export function messages(locale: Locale): Messages {
  return locale === "zh" ? ZH : EN;
}

export function detectLocale(env = process.env): Locale {
  const raw = env.DSH_LOCALE ?? env.LANG ?? "";
  return /^zh/i.test(raw) ? "zh" : "en";
}
