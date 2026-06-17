---
name: project-overview
description: Bastion parity rebuild — agent roles, directory ownership, prime directives
metadata:
  type: project
---

Parity rebuild of bastiontower.com: legacy .NET Core 1.1 + MongoDB → Strapi Cloud + Astro SSG on Cloudflare Pages. Design, content, structure, URLs, and editing experience are preserved exactly.

**Prime directives:**
- Model must not change. `old/` is the source of truth; Strapi mirrors it 1:1. Deviations only where Strapi cannot represent C#; every deviation logged in `docs/model-mapping.md`.
- Pixel parity. Markup and class names reproduced exactly.
- `old/` is immutable — read only.

**My scope:** `cms/` and `docs/` only (especially `docs/model-mapping.md`). `scripts/`, `web/`, `qa/` belong to other agents.

**Why:** Silent cross-directory edits cause contract drift between agents.

**How to apply:** Before any write, confirm the target path is under `cms/` or `docs/`. Cross-cutting notes go in `docs/decisions.md`.
