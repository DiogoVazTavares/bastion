# URL inventory — the frozen parity fixture

The complete set of URLs the rebuilt site must produce. Hand-maintained (≈21 rows): slugs
are translated per locale, site renders at `/en` `/fr` `/nl`. astro-builder treats this as
the routing spec; parity-qa diffs the build output against it on every run. Any old URL not
reproducible as a route becomes an explicit 301 in Cloudflare Pages `_redirects`, recorded
in the redirects section below.

Verify the rows against the live site navigation once before the first issue is worked.

| Page (single-type) | en | fr | nl |
|---|---|---|---|
| Home | `/en` | `/fr` | `/nl` |
| Building | `/en/building` | `/fr/<slug-fr>` | `/nl/<slug-nl>` |
| Accommodation | `/en/accommodation` | `/fr/accommodation` | `/nl/accommodation` |
| Services | `/en/services` | `/fr/services` | `/nl/services` |
| Location | `/en/location` | `/fr/location` | `/nl/location` |
| Terms | `/en//terms` | `/fr/terms` | `/nl/terms` |
| Credits | `/en/credits` | `/fr/credits` | `/nl/credits` |

> Replace every `<slug-*>` with the real translated slug from the live site. Confirm the
> exact English slugs too (e.g. is it `/en/building` or `/en/the-building`?).

### Accommodation per-floor lightbox deep-links (shareable)

Beyond the page rows above, the Accommodation page produces a **shareable URL per floor that
has lightbox images**: `/{locale}/accommodation/{floor-uid}`. In the legacy site these are not
separate documents — they are produced by client JS: when a floor lightbox opens, `Lightbox.ts`
calls `HistoryManager.ChangeState` → `history.pushState`, appending the floor's `uid` suffix to
the current page URL. On a cold visit the catch-all route `{lang}/{controller}/{id?}` serves the
normal Accommodation page and `Discover()` auto-opens the matching lightbox. `ViewBag.Lightbox`
(set by `AccommodationController`) is dead code — no view reads it; the behaviour is purely
client-side.

These URLs were missed in the original inventory. **Owner: issue #20 (Accommodation page).** To
reproduce on the SSG build, #20 must: (a) generate a static `/[locale]/accommodation/[uid]` page
per floor-with-images that renders the accommodation page with the lightbox auto-opened, and
(b) push `/{locale}/accommodation/{uid}` via `history.pushState` when a lightbox opens (and pop
it on close). The `blocks.floors` slice (#15) deliberately does **not** implement the deep-link —
it is page-independent; the suffix is appended to whatever page hosts the block.

## Root behaviour

`/` → **TBD**: redirect to `/en`, language detection, or its own page? Record the decision
here; astro-builder and parity-qa both depend on it.

## hreflang / canonical

Each page emits hreflang alternates linking its three locale URLs + canonical. parity-qa
extracts and compares these against the live site. _(Note any per-page exceptions here.)_

## Redirects (Cloudflare Pages `_redirects`)

Old URLs that cannot be reproduced 1:1 as routes. Each row is a logged parity deviation.

| From (old URL) | To (new URL) | Status | Reason |
|---|---|---|---|
| _(none yet)_ | | 301 | |
