# 1. Linting, formatting, and type-checking for the `cms` project

- Status: Accepted
- Date: 2026-06-11
- Deciders: Diogo Vaz

## Context

The `cms/` package is a Strapi 5.48 (TypeScript) application — one of three packages in
the bastiontower.com monorepo (`cms`, `web`, `scripts`). It had no linting, formatting, or
type-checking enforcement. We wanted all three, with the constraint that the project is
maintained by a **single developer**, so any tooling must be fast and low-friction —
otherwise it gets bypassed with `git commit --no-verify` and provides no value.

Strapi-specific facts that shaped the decision:

- The codebase has **two TypeScript worlds**: the server (`src/api`, `src/index.ts`,
  `config/`, CommonJS) and the admin panel (`src/admin/`, React/JSX/Vite). They have
  separate `tsconfig.json` files; the root one excludes `src/admin/` and `src/plugins/`.
- Strapi **auto-generates** `types/generated/*.d.ts` via `strapi ts:generate-types`. These
  must be ignored by lint/format tooling.
- Strapi 5 ships **no bundled ESLint config** — you bring your own.
- Most `cms` code is generated scaffolding (controllers/routes/services) plus light
  customization, so type-aware lint rules earn little here.

## Decision

**Biome** for linting + formatting, **`tsc`** for type-checking, **Lefthook** for git hooks.

### Biome (lint + format)

A single Rust binary replaces ESLint + Prettier + import-sorting with one `cms/biome.json`.
Config matches the existing Strapi scaffold style: single quotes, 2-space indent,
semicolons, trailing commas, 100-char lines. Ignores `node_modules`, `dist`, `build`,
`.strapi`, `.cache`, `.tmp`, `types/generated`, `*.example.*`, and Strapi state files.

Scripts in `cms/package.json`:

| Script | Command |
|---|---|
| `lint` | `biome lint .` |
| `format` | `biome format --write .` |
| `check` | `biome check --write .` (lint + format + import sort) |
| `typecheck` | `tsc --noEmit -p tsconfig.json && tsc --noEmit -p src/admin/tsconfig.json` |
| `types:generate` | `strapi ts:generate-types` |

The `typecheck` script runs **both** tsconfigs so the server and admin worlds are each
covered.

### Lefthook (git hooks)

Hooks live at the **repo root** (git hooks are repo-wide), so Lefthook is a root
`devDependency` with a root `lefthook.yml`. Work is **split by cost**:

- **`pre-commit`** — Biome `check --write` on **staged files only**, scoped to `cms/` via
  `root: cms/`, with `stage_fixed: true` to auto-restage fixes. Sub-second; you barely
  notice it.
- **`pre-push`** — full-project `npm run typecheck`. Type-checking is whole-project and
  takes ~5s — too slow for every commit, and pointless on WIP commits that don't yet
  typecheck. Push is the right gate: the last moment before code leaves the machine.

## Alternatives considered

**ESLint (flat config) + Prettier + `tsc`.** The ecosystem standard, with type-aware lint
rules and React-hooks rules for the admin. Rejected as the default because it means 5–6 dev
dependencies, slower runs, and an ESLint↔Prettier compatibility surface to maintain — poor
value for a mostly-scaffolded CMS maintained by one person. Worth revisiting only if the
`cms` grows substantial custom backend logic where type-aware rules (no-floating-promises,
no-unsafe-`any`) start to pay off.

**Husky + lint-staged** (instead of Lefthook). Rejected: two packages plus a `lint-staged`
config plus `.husky/` shell shims, where Lefthook does staged-file filtering and
auto-restaging natively in one binary + one YAML file.

## Consequences

- Single fast formatter/linter; one config file; minimal maintenance.
- Type safety is enforced before push, not just available.
- **The hooks are a safety net, not a gate** — a solo dev can always `--no-verify`. If CI is
  added later (e.g. a GitHub Action running `biome ci` + `typecheck`), that becomes the real
  gate and the hooks just save the round-trip.
- No type-aware lint rules (Biome limitation). Accepted given the project profile.
- Biome's `useIgnoreFile` is **off**: it expects a `.gitignore` inside `cms/`, but ours is at
  the repo root, so ignores are listed explicitly in `biome.json` instead.

### Bugs caught immediately by the new `typecheck` gate

Turning on `tsc` surfaced two pre-existing issues in `src/admin/app.tsx` (the CKEditor
preset), both now fixed:

1. **Literal widening** — the un-annotated `bastionPreset` const widened `classes: true` to
   `boolean`, which is wider than CKEditor's allowed `MatchClassPatterns`. Fixed by
   annotating `const bastionPreset: Preset` (from `@_sh/strapi-plugin-ckeditor`), which also
   type-checks the whole preset.
2. **Dead CKEditor 4 option** — `contentsCss` does not exist in CKEditor 5's `EditorConfig`
   and was silently ignored at runtime, so the 8 custom styles never previewed in the
   editor. Replaced with the plugin-supported `styles` field, loading
   `public/custom-styles.css` as a raw string via Vite's `?raw` import (with
   `src/admin/vite-env.d.ts` referencing `vite/client` for the type). The editor now
   actually previews the custom styles.
