# dsh-bundler

**One file, one ready-to-use agent environment.**

dsh-bundler is the **DSH plugin pack protocol** (`dsh.pack.json`) plus a **reference implementation** (a harness plugin) for DeepSeek Harness (DSH).

The DSH ecosystem moves fast — 1500+ plugins and counting. The problem was never the list; it's the environment. dsh-bundler provides two actions:

- **Pack** — pick the plugins you already have, choose a version strategy, and export a single `dsh.pack.json`.
- **Install** — hand that one file to someone (or another machine); one click reproduces the whole environment.

> **The protocol is the product.** The tool is just the protocol's first implementation. Anyone can build their own consumer against `SPEC.md` — that's what makes it a public standard, and a buffer against ecosystem churn.

- [Specification (English)](SPEC.md) · [规范 (中文)](SPEC.zh-CN.md)
- [README 中文版](README.zh-CN.md)

## Why

- **1500+ plugins, no guidance** — users need ready-to-use environments, not plugin lists.
- **Copying an agent setup is painful** — manually installing plugins, matching versions, wiring config.
- **The ecosystem changes fast** — any locked-down packaging scheme dies quickly. The protocol is thin, mirrors official semantics (`dsh.bundle` / `dsh plugin add`), and treats forward compatibility as law.

## How it works

### Pack (export)

Settings → select installed plugins → pick a version strategy (default `latest`) → export `dsh.pack.json`.

### Install (import)

```
validate (schemaVersion / kind / entry syntax)
  → resolve versions (latest / range / date anchor / commit)
  → translate (entries → official harness commands — the only layer that touches commands)
  → execute (sequential, idempotent: already installed & satisfied → skip)
  → report (per entry: installed / skipped / failed + reason, retryable)
```

The reference implementation never installs plugins itself — it orchestrates the harness's own install commands (`dsh plugin --profile <name> add ...`; `--profile` is required by the official CLI). If the official CLI changes, only the translation layer changes.

Entry types follow the official ecosystem: `bundle` (npm package), `git` (`owner/repo`, installed as `github:owner/repo`), and `skill` (SKILL.md files — installed via a file channel, not a CLI command).

## Example `dsh.pack.json`

```json
{
  "schemaVersion": 1,
  "kind": "dsh-pack",
  "name": "Translation Workbench",
  "description": "One-click translation stack",
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

## Architecture

```
SPEC.md                     — protocol v0.1 (format + forward-compat laws + migration convention)
core/                       — pure Node, zero DSH deps, independently testable (vitest)
  manifest    parse / validate (schemaVersion / kind / entry syntax)
  resolve     version resolution (latest / range / date anchor / commit)
  translate   entries → harness commands (single isolation point for CLI changes)
  orchestrate sequential install / idempotent skip / retry / snapshot rollback / report
ui/                         — harness plugin (cordis), settings + commands entry
  profile     installed-state truth source ($DSH_HOME/profiles/<name>/package.json)
  pack        installed plugins → dsh.pack.json (latest / current version strategy)
  install     dsh.pack.json → validate → orchestrate → report
  runner      dsh CLI executor + skill file channel (SKILL.md → skill root)
```

**Core principle**: `core/` only parses, validates, and orchestrates. The actual install always goes through the harness's own commands — `core/` never touches the filesystem to install plugins.

## Forward-compatibility laws (summary)

1. Unknown fields **must** be ignored — consumers must never hard-fail on fields they don't know.
2. Unknown entry types → **warn + skip + report**, never abort the whole pack.
3. `schemaVersion` increments + a built-in migration table ships with the tool.
4. Entry `id`s use only official identification semantics (repo / npm / bundle id); the translation layer is the single isolation point for official command changes.

Full text: [SPEC.md](SPEC.md) · [SPEC.zh-CN.md](SPEC.zh-CN.md)

## Roadmap

| Milestone | What |
|---|---|
| M0 | ✅ Repository skeleton: bilingual README + SPEC v0.1 |
| M1 | ✅ core: manifest + resolve + translate + orchestrate + satisfies (121 tests) |
| M2 | ✅ ui: cordis plugin — settings + `/dsh-bundler-pack` + `/dsh-bundler-install` commands, runner, profile access, i18n |
| M3 | (optional, market side) `data/packs.json` registry channel + web listing |
| M4 | Seed packs ×5: translation / code review / reverse analysis / writing / automation |

## Bilingual policy

This project targets Chinese and English users from day one:

- **Canonical docs**: English (`README.md`, `SPEC.md`); Chinese translations (`README.zh-CN.md`, `SPEC.zh-CN.md`) are maintained in lockstep and equally supported.
- **Code comments**: English.
- **User-facing UI strings**: zh/en via i18n, following the harness locale (M2).
- **Contributions**: doc changes must update both languages.

## Contributing

Contributions are welcome — docs, protocol discussion, and reference implementation. Open an issue or a PR. Protocol changes go through `SPEC.md` (see its change process).

## License

[MIT](LICENSE)
