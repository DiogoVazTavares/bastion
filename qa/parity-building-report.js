#!/usr/bin/env node
/**
 * Building page targeted parity report
 * Scope: hero, building blocks, partners slider, paragraph blocks, footer contact
 * Excludes: site header / nav
 * Viewport: 1280x900 (desktop)
 * Output: /tmp/parity-building/
 */
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs';
import path from 'path';

const OUT_DIR = '/tmp/parity-building';
const PROD_URL = 'https://bastiontower.com/en/Building';
const LOCAL_URL = 'http://localhost:4321/en/building';
const VIEWPORT = { width: 1280, height: 900 };

fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── helpers ────────────────────────────────────────────────────────────────

function diffPixels(pathA, pathB, diffPath) {
  const imgA = PNG.sync.read(fs.readFileSync(pathA));
  const imgB = PNG.sync.read(fs.readFileSync(pathB));
  const w = Math.min(imgA.width, imgB.width);
  const h = Math.min(imgA.height, imgB.height);
  const diff = new PNG({ width: w, height: h });

  function crop(img) {
    if (img.width === w && img.height === h) return img.data;
    const buf = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = (y * img.width + x) * 4;
        const di = (y * w + x) * 4;
        buf[di] = img.data[si]; buf[di+1] = img.data[si+1];
        buf[di+2] = img.data[si+2]; buf[di+3] = img.data[si+3];
      }
    }
    return buf;
  }

  const n = pixelmatch(crop(imgA), crop(imgB), diff.data, w, h, { threshold: 0.1, includeAA: false });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  return { diffPct: (n / (w * h) * 100).toFixed(2), diffPx: n, total: w * h, w, h };
}

async function screenshotSection(page, selector, filePath, padding = 0) {
  const el = await page.$(selector);
  if (!el) return null;
  const box = await el.boundingBox();
  if (!box) return null;

  // Scroll element into view then take a full-page screenshot cropped to section
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  // Re-fetch bounding box after scroll (position changes)
  const box2 = await el.boundingBox();
  if (!box2) return null;

  const x = Math.max(0, Math.floor(box2.x - padding));
  const y = Math.max(0, Math.floor(box2.y - padding));
  const width = Math.min(VIEWPORT.width - x, Math.ceil(box2.width + padding * 2));
  const height = Math.ceil(box2.height + padding * 2);

  if (width <= 0 || height <= 0) return null;

  const clip = { x, y, width, height };
  await page.screenshot({ path: filePath, clip });
  return clip;
}

// ─── structural extraction ───────────────────────────────────────────────────

function extractBuildingStructure(page) {
  return page.evaluate(() => {
    // Hero
    const heroEl = document.querySelector('.main__hero.hero, .hero');
    const heroTitle = document.querySelector('.hero__title, .main__title, h1');
    const heroSubtitle = document.querySelector('.hero__subtitle, .hero__text');
    const heroImg = document.querySelector('.hero__image, .hero img');

    // Building items (big-figure + text rows)
    const buildingItems = Array.from(document.querySelectorAll('.building--right, .building--left'));
    const buildingItemData = buildingItems.map((el) => {
      const bigImg = el.querySelector('.building__big-image img, .building__big img, img');
      const smallImg = el.querySelector('.building__small-image img, .building__small img');
      const title = el.querySelector('h2, h3, .building__title, .panel__title');
      const text = el.querySelector('.building__text, p, .text');
      return {
        classes: el.className.trim(),
        bigImageSrc: bigImg?.getAttribute('src') ?? null,
        smallImageSrc: smallImg?.getAttribute('src') ?? null,
        titleText: title?.textContent.trim() ?? null,
        bodyText: text?.textContent.trim().substring(0, 200) ?? null,
      };
    });

    // Partners
    const partnersEl = document.querySelector('.partners');
    const partnerImages = Array.from(document.querySelectorAll('.partners img, .partners__logo, .partners__item img'));
    const partnersTrack = document.querySelector('[class*="slider"], [class*="track"], [class*="carousel"]');

    // Paragraph/text blocks
    const paragraphBlocks = Array.from(document.querySelectorAll('.panel--paragraph, .paragraph, [class*="paragraph"]'))
      .filter(el => !el.closest('.main__hero'));
    const paragraphData = paragraphBlocks.map((el) => ({
      classes: el.className.trim(),
      titleText: el.querySelector('h2, h3, .panel__title')?.textContent.trim() ?? null,
      bodyText: el.querySelector('p, .text, .panel__text')?.textContent.trim().substring(0, 200) ?? null,
    }));

    // Footer contact section
    const contactEl = document.querySelector('.contact, #contact, [class*="contact"]');
    const footerEl = document.querySelector('footer, .footer');

    // All .section wrappers
    const sections = Array.from(document.querySelectorAll('.section'));

    // All headings (excluding nav)
    const headings = Array.from(document.querySelectorAll('main h1, main h2, main h3, h1, h2, h3'))
      .filter(h => !h.closest('nav') && !h.closest('header'))
      .map(h => ({ tag: h.tagName.toLowerCase(), text: h.textContent.trim() }));

    // Animation classes (data attributes for scroll-triggered fade)
    const animatedEls = Array.from(document.querySelectorAll('[data-spy-viewport], [data-animation], [class*="fade"], [class*="animate"], [class*="reveal"]'))
      .filter(el => !el.closest('nav') && !el.closest('header'))
      .map(el => ({ tag: el.tagName.toLowerCase(), classes: el.className.trim(), dataSpyViewport: el.hasAttribute('data-spy-viewport') }));

    // Partners autoplay: look for JS-driven slider attributes
    const partnersSlider = document.querySelector('.partners__slider, [class*="partners"][class*="slider"], .partners [data-spy-viewport]');

    return {
      hero: {
        present: !!heroEl,
        hasDataSpyViewport: heroEl?.hasAttribute('data-spy-viewport') ?? false,
        titleText: heroTitle?.textContent.trim() ?? null,
        subtitleText: heroSubtitle?.textContent.trim() ?? null,
        hasImage: !!heroImg,
        imageSrc: heroImg?.getAttribute('src') ?? null,
      },
      buildingItems: {
        count: buildingItems.length,
        items: buildingItemData,
      },
      partners: {
        present: !!partnersEl,
        imageCount: partnerImages.length,
        hasSliderElement: !!partnersTrack,
        hasDedicatedSlider: !!partnersSlider,
        titleText: partnersEl?.querySelector('h2, h3, .panel__title')?.textContent.trim() ?? null,
      },
      paragraphBlocks: {
        count: paragraphBlocks.length,
        blocks: paragraphData,
      },
      contact: {
        present: !!contactEl,
        classes: contactEl?.className.trim() ?? null,
        titleText: contactEl?.querySelector('h2, h3, .panel__title')?.textContent.trim() ?? null,
        bodyText: contactEl?.querySelector('p, .text')?.textContent.trim().substring(0, 300) ?? null,
      },
      footer: {
        present: !!footerEl,
        classes: footerEl?.className.trim() ?? null,
      },
      sections: {
        count: sections.length,
        classes: sections.map(s => s.className.trim()),
      },
      headings,
      animatedElementCount: animatedEls.length,
      animatedElements: animatedEls.slice(0, 20),
    };
  });
}

function extractMeta(page) {
  return page.evaluate(() => {
    const getMeta = (sel) => document.querySelector(sel)?.getAttribute('content') ?? null;
    return {
      title: document.title,
      description: getMeta('meta[name="description"]'),
      ogTitle: getMeta('meta[property="og:title"]'),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
      hreflangs: Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]'))
        .map(el => ({ hreflang: el.getAttribute('hreflang'), href: el.getAttribute('href') })),
    };
  });
}

// ─── section screenshot helpers ─────────────────────────────────────────────

async function captureNamedSections(page, label, sections) {
  const paths = {};
  for (const { name, selector } of sections) {
    const filePath = path.join(OUT_DIR, `${label}-${name}.png`);
    const clip = await screenshotSection(page, selector, filePath);
    if (clip) {
      paths[name] = filePath;
    } else {
      paths[name] = null;
    }
  }
  return paths;
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const prodPage = await ctx.newPage();
  const localPage = await ctx.newPage();

  const findings = [];
  const passes = [];

  console.log('Loading production page…');
  const prodResp = await prodPage.goto(PROD_URL, { waitUntil: 'networkidle', timeout: 30000 });
  console.log(`Production: HTTP ${prodResp?.status()}`);

  console.log('Loading local page…');
  const localResp = await localPage.goto(LOCAL_URL, { waitUntil: 'networkidle', timeout: 30000 });
  console.log(`Local: HTTP ${localResp?.status()}`);

  if (localResp?.status() !== 200) findings.push(`FATAL: local returned HTTP ${localResp?.status()}`);

  // ── 1. Full-page screenshots ─────────────────────────────────────────────
  console.log('\nCapturing full-page screenshots…');

  const prodFullPath = path.join(OUT_DIR, 'prod-full.png');
  const localFullPath = path.join(OUT_DIR, 'local-full.png');
  const diffFullPath = path.join(OUT_DIR, 'diff-full.png');

  await prodPage.screenshot({ path: prodFullPath, fullPage: true });
  await localPage.screenshot({ path: localFullPath, fullPage: true });

  const fullDiff = diffPixels(prodFullPath, localFullPath, diffFullPath);
  console.log(`Full-page pixel diff: ${fullDiff.diffPct}% (${fullDiff.diffPx}/${fullDiff.total} px)`);

  // Note: cookie banner on prod, skip top 50px from diff comparison in narrative
  const COOKIE_BANNER_OFFSET = 50;

  // ── 2. Section screenshots ───────────────────────────────────────────────
  console.log('\nCapturing section screenshots…');

  // Scroll through page to trigger lazy loads
  for (const page of [prodPage, localPage]) {
    await page.evaluate(async () => {
      const delay = ms => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 10; i++) {
        window.scrollTo(0, i * (document.body.scrollHeight / 10));
        await delay(300);
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1000);
  }

  const sectionSelectors = [
    { name: 'hero', selector: '.main__hero.hero, .hero, [class*="hero"]' },
    { name: 'building-block-1', selector: '.building--right:nth-of-type(1), .building--left:nth-of-type(1), .building:nth-of-type(1)' },
    { name: 'partners', selector: '.partners, [class*="partners"]' },
    { name: 'contact', selector: '.contact, #contact, [class*="contact"]' },
    { name: 'footer', selector: 'footer, .footer' },
  ];

  const prodSections = await captureNamedSections(prodPage, 'prod', sectionSelectors);
  const localSections = await captureNamedSections(localPage, 'local', sectionSelectors);

  // Section-level diffs
  const sectionDiffs = {};
  for (const { name } of sectionSelectors) {
    if (prodSections[name] && localSections[name]) {
      const diffPath = path.join(OUT_DIR, `diff-${name}.png`);
      try {
        sectionDiffs[name] = diffPixels(prodSections[name], localSections[name], diffPath);
        console.log(`  [${name}] diff: ${sectionDiffs[name].diffPct}%`);
      } catch (e) {
        console.log(`  [${name}] diff SKIPPED (dimension mismatch or error): ${e.message}`);
        sectionDiffs[name] = null;
      }
    } else {
      console.log(`  [${name}] section NOT FOUND on ${prodSections[name] ? 'local' : 'prod'}`);
    }
  }

  // ── 3. Structural extraction ─────────────────────────────────────────────
  console.log('\nExtracting DOM structure…');
  const [prodStruct, localStruct] = await Promise.all([
    extractBuildingStructure(prodPage),
    extractBuildingStructure(localPage),
  ]);
  const [prodMeta, localMeta] = await Promise.all([
    extractMeta(prodPage),
    extractMeta(localPage),
  ]);

  // Save raw data
  fs.writeFileSync(path.join(OUT_DIR, 'prod-struct.json'), JSON.stringify({ meta: prodMeta, struct: prodStruct }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'local-struct.json'), JSON.stringify({ meta: localMeta, struct: localStruct }, null, 2));

  // ── 4. Checks ────────────────────────────────────────────────────────────
  console.log('\nRunning checks…');

  // META
  if (prodMeta.title === localMeta.title) {
    passes.push(`META: <title> matches — "${localMeta.title}"`);
  } else {
    findings.push(`META: <title> mismatch\n    prod:  "${prodMeta.title}"\n    local: "${localMeta.title}"`);
  }

  if (prodMeta.description && localMeta.description && prodMeta.description === localMeta.description) {
    passes.push('META: meta description matches');
  } else if (!localMeta.description) {
    findings.push('META: meta description missing on local');
  } else if (prodMeta.description !== localMeta.description) {
    findings.push(`META: description mismatch\n    prod:  "${prodMeta.description}"\n    local: "${localMeta.description}"`);
  }

  const prodHreflangs = prodMeta.hreflangs.map(h => h.hreflang).sort().join(',');
  const localHreflangs = localMeta.hreflangs.map(h => h.hreflang).sort().join(',');
  if (prodHreflangs === localHreflangs && localHreflangs !== '') {
    passes.push(`META: hreflang tags match — [${localHreflangs}]`);
  } else if (!localHreflangs) {
    findings.push('META: hreflang tags absent on local');
  } else {
    findings.push(`META: hreflang mismatch\n    prod:  [${prodHreflangs}]\n    local: [${localHreflangs}]`);
  }

  // HERO
  if (localStruct.hero.present) {
    passes.push('HERO: .hero element present');
  } else {
    findings.push('HERO: .hero element absent');
  }

  if (localStruct.hero.hasDataSpyViewport) {
    passes.push('HERO: data-spy-viewport attribute present');
  } else {
    findings.push('HERO: data-spy-viewport attribute missing (scroll-triggered fade-in will not work)');
  }

  if (localStruct.hero.hasImage) {
    passes.push('HERO: hero image present');
  } else {
    findings.push('HERO: hero image absent');
  }

  // Hero text content
  if (prodStruct.hero.titleText && localStruct.hero.titleText) {
    if (prodStruct.hero.titleText === localStruct.hero.titleText) {
      passes.push(`HERO: title text matches — "${localStruct.hero.titleText}"`);
    } else {
      findings.push(`HERO: title text mismatch\n    prod:  "${prodStruct.hero.titleText}"\n    local: "${localStruct.hero.titleText}"`);
    }
  } else if (!localStruct.hero.titleText) {
    findings.push('HERO: title text not found on local');
  }

  // BUILDING ITEMS
  if (localStruct.buildingItems.count === 0) {
    findings.push('BUILDING ITEMS: no .building--right or .building--left elements found');
  } else {
    passes.push(`BUILDING ITEMS: ${localStruct.buildingItems.count} building item(s) found`);
    if (prodStruct.buildingItems.count !== localStruct.buildingItems.count) {
      findings.push(`BUILDING ITEMS: count mismatch — prod: ${prodStruct.buildingItems.count}, local: ${localStruct.buildingItems.count}`);
    } else {
      passes.push(`BUILDING ITEMS: count matches (${localStruct.buildingItems.count})`);
    }
    // Check each item has images
    localStruct.buildingItems.items.forEach((item, i) => {
      if (!item.bigImageSrc) {
        findings.push(`BUILDING ITEMS: item ${i+1} — big image src missing`);
      }
    });
  }

  // Section count
  if (localStruct.sections.count >= 2) {
    passes.push(`BLOCKS: ${localStruct.sections.count} .section wrappers found`);
  } else {
    findings.push(`BLOCKS: only ${localStruct.sections.count} .section wrappers (expected ≥2)`);
  }

  // PARTNERS
  if (localStruct.partners.present) {
    passes.push('PARTNERS: .partners element present');
  } else {
    findings.push('PARTNERS: .partners element absent');
  }

  if (localStruct.partners.imageCount > 0) {
    passes.push(`PARTNERS: ${localStruct.partners.imageCount} partner image(s) found`);
  } else {
    findings.push('PARTNERS: no partner images found');
  }

  if (prodStruct.partners.imageCount !== localStruct.partners.imageCount) {
    findings.push(`PARTNERS: image count mismatch — prod: ${prodStruct.partners.imageCount}, local: ${localStruct.partners.imageCount}`);
  }

  if (localStruct.partners.hasSliderElement || localStruct.partners.hasDedicatedSlider) {
    passes.push('PARTNERS: slider/carousel element detected');
  } else {
    findings.push('PARTNERS: no slider/carousel element detected — autoplay may not be wired up');
  }

  // CONTACT
  if (localStruct.contact.present) {
    passes.push('CONTACT: contact section present');
    if (prodStruct.contact.titleText && localStruct.contact.titleText) {
      if (prodStruct.contact.titleText === localStruct.contact.titleText) {
        passes.push(`CONTACT: title matches — "${localStruct.contact.titleText}"`);
      } else {
        findings.push(`CONTACT: title mismatch\n    prod:  "${prodStruct.contact.titleText}"\n    local: "${localStruct.contact.titleText}"`);
      }
    }
  } else {
    findings.push('CONTACT: contact section absent');
  }

  // HEADINGS
  const prodHeadings = prodStruct.headings.map(h => `${h.tag}:${h.text.substring(0,60)}`);
  const localHeadings = localStruct.headings.map(h => `${h.tag}:${h.text.substring(0,60)}`);
  const missingHeadings = prodHeadings.filter(h => !localHeadings.includes(h));
  const extraHeadings = localHeadings.filter(h => !prodHeadings.includes(h));
  if (missingHeadings.length === 0 && extraHeadings.length === 0) {
    passes.push('HEADINGS: heading set matches prod');
  } else {
    if (missingHeadings.length) findings.push(`HEADINGS: missing in local:\n  ${missingHeadings.join('\n  ')}`);
    if (extraHeadings.length) findings.push(`HEADINGS: extra in local (not in prod):\n  ${extraHeadings.join('\n  ')}`);
  }

  // ANIMATIONS
  if (prodStruct.animatedElementCount > 0 && localStruct.animatedElementCount === 0) {
    findings.push(`ANIMATIONS: prod has ${prodStruct.animatedElementCount} animated elements (data-spy-viewport/fade), local has 0`);
  } else if (localStruct.animatedElementCount > 0) {
    passes.push(`ANIMATIONS: ${localStruct.animatedElementCount} animated elements found on local`);
  }

  // VISUAL DIFF — full page
  const FULL_PAGE_THRESHOLD = 15; // generous: cookie banner, minor rendering diffs
  const visPass = parseFloat(fullDiff.diffPct) <= FULL_PAGE_THRESHOLD;
  if (visPass) {
    passes.push(`VISUAL: full-page pixel diff ${fullDiff.diffPct}% ≤ ${FULL_PAGE_THRESHOLD}% threshold`);
  } else {
    findings.push(`VISUAL: full-page pixel diff ${fullDiff.diffPct}% exceeds ${FULL_PAGE_THRESHOLD}% threshold`);
  }

  // Section visual diffs
  for (const [name, result] of Object.entries(sectionDiffs)) {
    if (!result) continue;
    const SECTION_THRESHOLD = name === 'hero' ? 20 : 10;
    const secPass = parseFloat(result.diffPct) <= SECTION_THRESHOLD;
    if (secPass) {
      passes.push(`VISUAL [${name}]: diff ${result.diffPct}% ≤ ${SECTION_THRESHOLD}%`);
    } else {
      findings.push(`VISUAL [${name}]: diff ${result.diffPct}% exceeds ${SECTION_THRESHOLD}% threshold`);
    }
  }

  // ── 5. Report ─────────────────────────────────────────────────────────────

  await browser.close();

  const reportData = {
    timestamp: new Date().toISOString(),
    prodUrl: PROD_URL,
    localUrl: LOCAL_URL,
    viewport: VIEWPORT,
    passes,
    findings,
    pixelDiff: { full: fullDiff, sections: sectionDiffs },
    prodStruct,
    localStruct,
    prodMeta,
    localMeta,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(reportData, null, 2));

  // Console summary
  console.log('\n\n════════════════════════════════════════════════════');
  console.log('BUILDING PAGE PARITY REPORT — en locale, 1280x900');
  console.log('════════════════════════════════════════════════════');
  console.log(`\nProduction: ${PROD_URL}`);
  console.log(`Local:      ${LOCAL_URL}`);
  console.log(`\nFull-page pixel diff: ${fullDiff.diffPct}%`);

  console.log(`\nPASSES (${passes.length}):`);
  passes.forEach(p => console.log(`  ✓ ${p}`));

  console.log(`\nFINDINGS (${findings.length}):`);
  findings.forEach(f => console.log(`  ✗ ${f}`));

  console.log('\n────────────────────────────────────────────────────');
  console.log(`Prod structure: ${JSON.stringify(prodStruct).substring(0, 200)}…`);
  console.log('\n────────────────────────────────────────────────────');
  console.log(`Local structure: ${JSON.stringify(localStruct).substring(0, 200)}…`);
  console.log('\n════════════════════════════════════════════════════');
  console.log(`VERDICT: ${findings.length === 0 ? 'PASS' : 'FAIL'} — ${findings.length} finding(s)`);
  console.log('════════════════════════════════════════════════════');
  console.log(`\nArtifacts in: ${OUT_DIR}`);

  process.exit(findings.length > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(2); });
