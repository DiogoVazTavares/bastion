---
name: harness-setup
description: QA harness location, toolchain, install steps, and how to run checks
metadata:
  type: project
---

Harness lives at `/Users/diogo.vaz/Documents/Repositories/Playground/bastion/qa/`.

Toolchain: Playwright 1.44+ (chromium), pixelmatch 6, pngjs 7. Node ESM modules.

Install: `cd qa && npm install && npx playwright install chromium`

Per-page check scripts: `node check-credits.js` etc.

Screenshots output: `qa/screenshots/<page>/`  
Config/thresholds: `qa/config/thresholds.json`

Viewports: desktop 1280×800, mobile 375×812.

Production base: `https://bastiontower.com`  
Local dev base: `http://localhost:4321`

Note: production uses capital-C URLs (`/en/Credits`) while local uses lowercase (`/en/credits`). Both return 200.
