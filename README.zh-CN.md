# dsh-bundler

**一个文件，一键装好一个 Agent 环境。**

dsh-bundler 是 DeepSeek Harness（DSH）的**插件整合包协议**（`dsh.pack.json`）+ **参考实现**（一个 harness 插件）。

DSH 生态超速发展——插件已有 1500+ 且仍在增长。用户缺的从来不是列表，而是**开箱即用的环境**。dsh-bundler 提供两个动作：

- **打包**——勾选你已装的插件，选好版本策略，导出一个 `dsh.pack.json` 文件。
- **装包**——把这一份文件交给别人（或另一台机器），一键复刻整个环境。

> **协议才是产品。** 工具只是协议的第一个实现。任何人都可以照着 `SPEC.md` 自己实现一个消费者——这是"公用"的终极形态，也是生态剧变时的缓冲层。

- [规范（中文）](SPEC.zh-CN.md) · [Specification (English)](SPEC.md)
- [English README](README.md)

## 为什么

- **1500+ 插件却没有指引**——用户需要的是开箱即用的环境，不是插件列表。
- **复刻别人的 Agent 环境很痛苦**——手动逐个装插件、对版本、配配置。
- **生态变化太快**——任何"锁死"的打包方案都会快速作废。协议做得很薄、语义贴官方（`dsh.bundle` / `dsh plugin add`），并把前向兼容当作铁律。

## 工作原理

### 打包（导出）

Settings 页 → 勾选已装插件 → 选版本策略（默认 `latest`）→ 导出 `dsh.pack.json`。

### 装包（导入）

```
校验（schemaVersion / kind / 条目语法）
  → 版本解析（latest / 范围 / 日期锚点 / commit）
  → 翻译（条目 → harness 官方命令——唯一接触命令的层）
  → 执行（顺序安装，幂等：已装且满足版本 → 跳过）
  → 报告（逐项：已装 / 跳过 / 失败+原因，可重试）
```

参考实现自己**不安装插件**——它只编排 harness 自己的安装命令（`dsh plugin --profile <名> add ...`；官方 CLI 要求 `--profile`）。官方 CLI 变了，只有翻译层需要改。

条目类型与官方生态对齐：`bundle`（npm 包）、`git`（`owner/repo`，以 `github:owner/repo` 安装）、`skill`（SKILL.md 文件——走文件通道安装，不是 CLI 命令）。

## `dsh.pack.json` 示例

```json
{
  "schemaVersion": 1,
  "kind": "dsh-pack",
  "name": "翻译工作流包",
  "description": "一键装好翻译全家桶",
  "author": "2BingLing",
  "plugins": [
    { "id": "@dsh/plugin-glossary", "type": "bundle", "version": ">=1.2.0" },
    { "id": "owner/translation-ui", "type": "git", "version": "#a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0" },
    { "id": "translation-workflow", "type": "skill", "version": "latest" }
  ],
  "config": {},
  "ext": {}
}
```

## 架构

```
SPEC.md                     —— 协议 v0.1（格式 + 前向兼容铁律 + 迁移表约定）
core/                       —— 纯 Node、零 DSH 依赖、可独立测试（vitest）
  manifest    解析 / 校验（schemaVersion / kind / 条目语法）
  resolve     版本解析（latest / 范围 / 日期锚点 / commit）
  translate   条目 → harness 命令（官方命令变化的唯一隔离点）
  orchestrate 顺序安装 / 幂等跳过 / 重试 / 快照回滚 / 报告
ui/                         —— harness 插件（cordis），settings + 命令入口
  profile     已装状态真源（$DSH_HOME/profiles/<名>/package.json）
  pack        已装插件 → dsh.pack.json（latest / current 版本策略）
  install     dsh.pack.json → 校验 → 编排 → 报告
  runner      dsh CLI 执行器 + 技能文件通道（SKILL.md → 技能根目录）
```

**核心原则**：`core/` 只做"解析、校验、编排"——真正执行安装永远通过 harness 自己的命令，`core/` 不直接操作文件系统装插件。

## 前向兼容铁律（摘要）

1. **未知字段必须忽略**——消费者不得因不认识字段就硬失败。
2. **未知条目类型 → 警告 + 跳过 + 报告**，不中断整包安装。
3. **schemaVersion 递增制 + 内置迁移表**（随工具发布）。
4. 条目 `id` 只用官方识别语义（repo / npm / bundle id）；翻译层单点隔离官方命令变化。

全文：[SPEC.zh-CN.md](SPEC.zh-CN.md) · [SPEC.md](SPEC.md)

## 路线图

| 里程碑 | 内容 |
|---|---|
| M0 | ✅ 仓库骨架：双语 README + SPEC v0.1 |
| M1 | ✅ core：manifest + resolve + translate + orchestrate + satisfies（121 测试） |
| M2 | ✅ ui：cordis 插件——settings + `/dsh-bundler-pack` + `/dsh-bundler-install` 命令、runner、profile 访问、i18n |
| M3 | （可选，market 侧）`data/packs.json` 收录通道 + Web 展示 |
| M4 | 种子整合包 ×5：翻译 / 代码审查 / 逆向分析 / 写作 / 自动化 |

## 双语政策

本项目从第一天起同时面向中文与英文用户：

- **规范性文档**：英文（`README.md`、`SPEC.md`）；中文译本（`README.zh-CN.md`、`SPEC.zh-CN.md`）同步维护，同等支持。
- **代码注释**：英文。
- **界面文案**：zh/en 走 i18n，跟随 harness 语言设置（M2）。
- **贡献要求**：文档改动需同时更新中英两版。

## 参与贡献

欢迎 issue 与 PR——文档、协议讨论、参考实现均可。协议改动走 `SPEC.md`（见其变更流程）。

## 许可证

[MIT](LICENSE)
