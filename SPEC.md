# dsh-bundler SPEC — `dsh.pack.json` Protocol

**Version**: v0.1 (schemaVersion 1)
**Status**: Draft — reference implementation under development
**Languages**: English (canonical) · [中文](SPEC.zh-CN.md)

## 1. Introduction

The DeepSeek Harness (DSH) ecosystem ships 1500+ plugins, but users don't need a list — they need a ready-to-use environment. This document defines **`dsh.pack.json`**, a convention for bundling a set of plugins into a single, shareable file that reproduces an agent environment.

This repository also contains a reference implementation (a harness plugin) that consumes and produces `dsh.pack.json`. **The protocol is the contract; the tool is one implementation of it.** Any third party may implement their own consumer against this document.

## 2. Terminology

| Term | Meaning |
|---|---|
| **bundle** | The official DSH single-plugin package format: each installable plugin declares a `dsh.bundle` manifest, installed via `dsh plugin add <package>`. |
| **pack** | This protocol: a set of plugins (each itself a bundle or skill) plus version locking, described by one `dsh.pack.json`. *A pack is the layer the official ecosystem does not provide.* |
| **entry** | One plugin reference inside `plugins[]`. |
| **consumer** | Any tool that reads a `dsh.pack.json` (the reference implementation included). |
| **producer** | Any tool that writes a `dsh.pack.json` (the reference implementation included). |

## 3. Document identity

- **File name**: `dsh.pack.json` (conventional; consumers accept any filename — the content decides).
- **Content type**: JSON, UTF-8.
- **Marker**: `"kind": "dsh-pack"` — must be present and exact; prevents misreading other manifests.

## 4. Schema v0.1

### 4.1 Top-level fields

| Field | Type | Required | Description |
|---|---|---|---|
| `schemaVersion` | integer | **yes** | Protocol version, monotonically increasing (see §6). |
| `kind` | string | **yes** | Must be exactly `"dsh-pack"`. |
| `name` | string | **yes** | Human-readable pack name (any language). |
| `description` | string | no | One-line description. |
| `author` | string | no | Author identifier (GitHub semantics). |
| `plugins` | array | **yes** | Entries; see §4.2. |
| `config` | object | no | Reserved: plugin-level configuration. **v0.1: passed through verbatim, never validated.** |
| `ext` | object | no | Extension point: namespaced free-form fields. The protocol never interprets them. |

**Any other top-level field is preserved verbatim and ignored by consumers (Law 1).**

### 4.2 Entries (`plugins[]`)

Each entry:

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | **yes** | Official identification semantics only — see the table below. |
| `type` | string | **yes** | `skill` \| `cordis` \| `bundle`. Unknown types are preserved, warned, skipped, and reported (Law 2). |
| `version` | string | no | Version specifier, defaults to `latest`; see §4.3. |

`id` semantics by type:

| `type` | `id` form | Example |
|---|---|---|
| `skill` | repository in `owner/repo` form (installed from a repo whose root contains `SKILL.md`) | `owner/awesome-skill` |
| `cordis` | npm package name (cordis-marked, installed via `dsh plugin add`) | `@dsh/plugin-xyz` |
| `bundle` | official bundle id | `dsh-plugin-xyz` |

### 4.3 Version specifiers

A pack expresses **intent, not contract**: versions are resolved at install time, so a pack never breaks just because an author stopped updating.

| Specifier | Form | Resolution semantics |
|---|---|---|
| `latest` (default) | `latest` | Newest available version at install time. |
| Semver range | `>=1.2.0`, `^1.2.0`, `~1.2`, `1.x` | Any version satisfying the range; prefer the newest. |
| Date anchor | `YYYY-MM-DD` | Newest version published on or before that date. |
| Commit pin | 40-char hex SHA | Exact version; no resolution. Optional exact lock. |

Consumers MUST NOT fail a pack because a version cannot be resolved; see §5.4 / §7.

### 4.4 `config` (reserved)

Plugin-level configuration. **v0.1: pass through verbatim — never validate, never interpret.** Validating config content is a future version's concern.

### 4.5 `ext` (extension point)

Namespaced free-form data (`ext: { "my-namespace": { ... } }`). The protocol never interprets these fields; consumers MUST ignore them.

## 5. Forward-compatibility laws

These laws are the contract's backbone. Every consumer MUST implement them.

> **Law 1 — Unknown fields are ignored.** A consumer MUST NOT fail (or change behavior) because a document contains fields it does not recognize. Unknown top-level fields and unknown entry fields are preserved and passed through.

> **Law 2 — Unknown entry types are skipped with a warning.** A consumer MUST NOT abort the pack because one entry has an unknown `type`. It records a warning, skips the entry, continues, and reports it in the final report.

> **Law 3 — `schemaVersion` increments, with a built-in migration table.** The reference implementation ships a migration map (e.g. v1 → v2 field renames). A consumer SHOULD apply known migrations before validating. A document with an unknown, newer `schemaVersion` MUST be rejected with a clear error — never silently mis-parsed.

> **Law 4 — `id` uses only official identification semantics; the translation layer is the single isolation point.** Entry `id`s are repo / npm / bundle ids — never command fragments. Consumers keep command generation in one layer; when official commands change, only that layer changes.

## 6. Schema versioning & migration table

- `schemaVersion` is a monotonically increasing integer.
- Consumers accept `schemaVersion <= their own`, applying the shipped migration table when needed.
- The migration table lives in the reference implementation; each entry maps `vN → vN+1` (field renames / defaults).
- Producers write the newest `schemaVersion` they support.

**v0.1 migration table**: (empty — first version)

## 7. Reference implementation behavior

The reference implementation (this repository) MUST:

1. **Validate** — `schemaVersion`, `kind`, and entry syntax per §4. Hard errors only for: invalid JSON, wrong `kind`, unsupported `schemaVersion`, missing required fields, malformed entries. Everything else is a warning.
2. **Resolve** — per §4.3. A resolution failure marks the entry `failed` in the report; it never aborts the pack.
3. **Translate** — entries to official harness commands (`dsh plugin add ...`; `--profile` supported). This is the only layer that knows commands.
4. **Execute** — sequentially, in document order. **Idempotent**: an entry already installed and satisfying its version spec is skipped (reported as `skipped`).
5. **Report** — per entry: `installed` / `skipped` / `failed` + reason. Failed entries are retryable. Summary at the end.

### Error-handling laws

- A failing entry MUST NOT interrupt the pack (v0.1 has no `stopOnError`).
- Rollback only rolls back **this install's changes**: the consumer snapshots installed state before executing and restores it on failure.
- Anything unknown: **warn + skip + report**, never hard-fail.

### Install flow

```
validate → resolve → translate → execute (idempotent) → report
```

## 8. Non-goals (v0.1)

- Validating or interpreting `config` content.
- Pack-to-pack dependencies.
- Uninstall / update flows (out of scope — the harness handles those).
- Any coupling to plugin markets or registries (market integration is optional and lives outside the protocol).

## 9. Examples

### Minimal pack

```json
{
  "schemaVersion": 1,
  "kind": "dsh-pack",
  "name": "Minimal",
  "plugins": []
}
```

### Full example — Translation Workbench

```json
{
  "schemaVersion": 1,
  "kind": "dsh-pack",
  "name": "Translation Workbench",
  "description": "One-click translation stack",
  "author": "2BingLing",
  "plugins": [
    { "id": "owner/translation-skill", "type": "skill", "version": "latest" },
    { "id": "@dsh/plugin-glossary", "type": "cordis", "version": ">=1.2.0" },
    { "id": "dsh-plugin-tm", "type": "bundle", "version": "2026-08-15" }
  ],
  "config": {},
  "ext": { "example-namespace": { "note": "ignored by consumers" } }
}
```

## 10. Change process

- Any protocol change is a SPEC change: update this document and its Chinese translation together.
- Breaking changes bump `schemaVersion` and add a migration-table entry; non-breaking additions keep the version and are documented as accepted extensions.
- The reference implementation MUST implement every law in §5 before a release is tagged.

## License

The protocol (this document) is public and free to implement. The reference implementation is MIT-licensed.
