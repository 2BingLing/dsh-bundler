# dsh-bundler 规范 —— `dsh.pack.json` 协议

**版本**：v0.1（schemaVersion 1）
**状态**：草案——参考实现开发中
**语言**：中文 · [English (canonical)](SPEC.md)

## 1. 引言

DeepSeek Harness（DSH）生态已有 1500+ 插件，但用户缺的从来不是列表，而是**开箱即用的环境**。本文档定义 **`dsh.pack.json`**：一种把一组插件打包进单个可分享文件、从而复刻一个 Agent 环境的约定。

本仓库同时提供参考实现（一个 harness 插件），用于消费与产出 `dsh.pack.json`。**协议是契约，工具只是协议的一个实现。** 任何第三方都可以照本文档自行实现消费者。

## 2. 术语

| 术语 | 含义 |
|---|---|
| **bundle** | 携带 DSH 插件层的 npm 包：`package.json` 声明 `dsh.bundle.patch`，指向一份 `cordis.patch.yml`。通过 `dsh plugin --profile <名> add <包>` 装入 profile。 |
| **profile** | 可运行的 DSH 组合目录（`$DSH_HOME/profiles/<名>/`）：`package.json` 携带 `dsh.profile.bundles`（有序 bundle 层列表）与 pnpm 管理的 `dependencies`。 |
| **skill** | Agent 技能：`<名>/SKILL.md`（或 `<名>.md`）文件，由 harness 从技能根目录（`$DSH_HOME/skills/`、`.dsh/skills/` 等）扫描发现。技能是文件，不是 npm 包。 |
| **pack** | 本协议：一组条目（bundle、git 安装的 bundle 和/或 skill）加版本锁定，由一份 `dsh.pack.json` 描述。*pack 正是官方生态没有提供的那一层。* |
| **条目（entry）** | `plugins[]` 中的一条插件/技能引用。 |
| **消费者（consumer）** | 任何读取 `dsh.pack.json` 的工具（含参考实现）。 |
| **生产者（producer）** | 任何写出 `dsh.pack.json` 的工具（含参考实现）。 |

## 3. 文档身份

- **文件名**：`dsh.pack.json`（约定俗成；消费者接受任意文件名——由内容决定）。
- **内容类型**：JSON，UTF-8。
- **标识**：`"kind": "dsh-pack"`——必须存在且精确匹配；防止误认其他 manifest。

## 4. Schema v0.1

### 4.1 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `schemaVersion` | 整数 | **是** | 协议版本，递增制（见 §6）。 |
| `kind` | 字符串 | **是** | 必须精确为 `"dsh-pack"`。 |
| `name` | 字符串 | **是** | 人类可读的包名（任意语言）。 |
| `description` | 字符串 | 否 | 一句话描述。 |
| `author` | 字符串 | 否 | 作者标识（GitHub 语义）。 |
| `plugins` | 数组 | **是** | 条目；见 §4.2。 |
| `config` | 对象 | 否 | 预留：插件级配置。**v0.1：原样透传，绝不校验。** |
| `ext` | 对象 | 否 | 扩展点：命名空间自由字段。协议永不解释它们。 |

**任何其他顶层字段由消费者原样保留并忽略（铁律 1）。**

### 4.2 条目（`plugins[]`）

每条目：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | 字符串 | **是** | 按 `type` 的识别语义——见下表。 |
| `type` | 字符串 | **是** | `bundle` \| `git` \| `skill`。未知类型被保留、警告、跳过并报告（铁律 2）。 |
| `version` | 字符串 | 否 | 版本说明符，默认 `latest`；见 §4.3。 |

按类型的 `id` 语义：

| `type` | `id` 形式 | 安装语义 | 示例 |
|---|---|---|---|
| `bundle` | npm 包名 | `dsh plugin --profile <p> add <id>` | `@dsh/plugin-xyz` |
| `git` | `owner/repo` 形式的仓库 | `dsh plugin --profile <p> add github:<id>` | `owner/awesome-plugin` |
| `skill` | 技能目录名 | 文件通道：把 `<id>/SKILL.md` 落盘到技能根目录（不是 CLI 命令） | `translation-workflow` |

### 4.3 版本说明符

包表达的是**意图而非契约**：版本在安装时解析，包不会因为作者停止更新就作废。

| 说明符 | 形式 | 解析语义 |
|---|---|---|
| `latest`（默认） | `latest` | 安装时刻的最新可用版本（`git` 为默认分支）。 |
| semver 范围 | `>=1.2.0`、`^1.2.0`、`~1.2`、`1.x` | 满足范围的任意版本；优先最新（仅 `bundle`）。 |
| 日期锚点 | `YYYY-MM-DD` | 该日期当天或之前发布的最新版本；安装时解析为具体版本。 |
| commit 锁定 | `git` 用 `#<40 位十六进制>`；`bundle` 用精确版本（`1.2.3`） | 精确锁定；不做解析。 |

消费者**不得**因某个版本解析失败而放弃整个包；见 §5.4 / §7。

### 4.4 `config`（预留）

插件级配置。**v0.1：原样透传——绝不校验、绝不解释。** 校验 config 内容属于未来版本的事。

### 4.5 `ext`（扩展点）

命名空间自由数据（`ext: { "my-namespace": { ... } }`）。协议永不解释这些字段；消费者**必须**忽略它们。

## 5. 前向兼容铁律

这些铁律是契约的骨架。每个消费者**必须**实现它们。

> **铁律 1 —— 未知字段必须忽略。** 消费者**不得**因为文档含有不认识的字段而失败（或改变行为）。未知顶层字段与未知条目字段被原样保留并透传。

> **铁律 2 —— 未知条目类型：警告 + 跳过 + 报告。** 消费者**不得**因为某条目的 `type` 未知而中止整包。它记录警告、跳过该条目、继续执行，并在最终报告中上报。

> **铁律 3 —— schemaVersion 递增制 + 内置迁移表。** 参考实现随包发布迁移映射（如 v1 → v2 字段改名）。消费者在校验前**应该**应用已知迁移。遇到未知的更新 `schemaVersion` 的文档，**必须**以清晰错误拒绝——绝不静默误解析。

> **铁律 4 —— `id` 只用官方识别语义；翻译层是唯一隔离点。** 条目 `id` 是 repo / npm / bundle id——绝不是命令片段。消费者把命令生成集中在一层；官方命令变化时，只有那一层需要改。

## 6. Schema 版本化与迁移表

- `schemaVersion` 是单调递增的整数。
- 消费者接受 `schemaVersion <= 自身版本`，必要时应用随包迁移表。
- 迁移表随参考实现发布；每条目映射 `vN → vN+1`（字段改名 / 默认值）。
- 生产者写自己支持的最新 `schemaVersion`。

**v0.1 迁移表**：（空——首个版本）

## 7. 参考实现行为

参考实现（本仓库）**必须**：

1. **校验**——按 §4 校验 `schemaVersion`、`kind` 与条目语法。只有以下情况算硬错误：JSON 非法、`kind` 错误、`schemaVersion` 不支持、必填字段缺失、条目结构损坏。其余一律是警告。
2. **解析**——按 §4.3。解析失败把该条目标记为报告中的 `failed`；绝不中止整包。
3. **翻译**——条目 → 官方 harness 命令（`dsh plugin --profile <p> add ...`；官方 CLI 要求 `--profile`）。`skill` 条目翻译为文件通道指令而非 shell 命令。这是唯一认识命令的层。
4. **执行**——按文档顺序顺序执行。**幂等**：已安装且满足版本说明符的条目被跳过（报告为 `skipped`）。
5. **报告**——逐条目：`installed` / `skipped` / `failed` + 原因。失败条目可重试。最后给汇总。

### 错误处理铁律

- 单条目失败**不得**中断整包（v0.1 无 `stopOnError`）。
- 回滚只回滚**本次安装的变更**：消费者在执行前快照已装状态，失败时恢复。
- 任何不认识的东西：**警告 + 跳过 + 报告**，绝不硬失败。

### 安装流程

```
校验 → 解析 → 翻译 → 执行（幂等） → 报告
```

## 8. 非目标（v0.1）

- 校验或解释 `config` 内容。
- 包与包之间的依赖。
- 卸载 / 升级流程（超出范围——由 harness 处理）。
- 与任何插件市场/注册表的耦合（市场集成是可选且独立于协议之外的）。

## 9. 示例

### 最小包

```json
{
  "schemaVersion": 1,
  "kind": "dsh-pack",
  "name": "Minimal",
  "plugins": []
}
```

### 完整示例 —— 翻译工作流包

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
  "ext": { "example-namespace": { "note": "消费者会忽略它" } }
}
```

## 10. 变更流程

- 任何协议改动都是 SPEC 改动：本文档与其中文译本**必须同步更新**。
- 破坏性改动提升 `schemaVersion` 并新增迁移表条目；非破坏性新增保持版本号，并作为"已接受的扩展"记录。
- 参考实现**必须**在打发布 tag 前实现 §5 的全部铁律。

## 许可证

协议（本文档）公开且可自由实现。参考实现采用 MIT 许可证。
