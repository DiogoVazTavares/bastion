#!/usr/bin/env node
/**
 * Building page parity check
 * Compares production (bastiontower.com) vs local dev (localhost:4321)
 * Checks: DOM structure, hero, blocks, building items, partners, lang switcher, meta, CSS classes, visual diff
 */
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROD_BASE = 'https://bastiontower.com';
const LOCAL_BASE = 'http://localhost:4321';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots', 'building');

// Building uses capital B on production
const LOCALES = [
  { locale: 'en', prod: '/en/Building', local: '/en/building' },
  { locale: 'fr', prod: '/fr/Building', local: '/fr/building' },
  { locale: 'nl', prod: '/nl/Building', local: '/nl/building' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 812 },
];

const PIXEL_THRESHOLD = 0.05; // 5% tolerance

// Ensure screenshots dir exists
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function extractMeta(page) {
  return page.evaluate(() => {
    const getMeta = (selector) =>
      document.querySelector(selector)?.getAttribute('content') ?? null;
    const hreflangs = Array.from(
      document.querySelectorAll('link[rel="alternate"][hreflang]')
    ).map((el) => ({ hreflang: el.getAttribute('hreflang'), href: el.getAttribute('href') }));
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;
    return {
      title: document.title,
      description: getMeta('meta[name="description"]'),
      ogTitle: getMeta('meta[property="og:title"]'),
      canonical,
      hreflangs,
    };
  });
}

function extractStructure(page) {
  return page.evaluate(() => {
    const results = {};

    // SVG elements have className as SVGAnimatedString, coerce with String()
    const allClasses = Array.from(document.querySelectorAll('[class]'))
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        classes: (typeof el.className === 'string' ? el.className : String(el.className.baseVal || '')).trim(),
      }))
      .filter((e) => e.classes.length > 0);

    // Headings
    results.headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => ({
      tag: h.tagName.toLowerCase(),
      text: h.textContent.trim(),
      classes: h.className.trim(),
    }));

    // Main content area — sections, panels, blocks
    const sections = Array.from(document.querySelectorAll('section, .panel, [class*="panel"], [class*="paragraph"], [class*="building"], [class*="partners"], .section'));
    results.sections = sections.map((s) => ({
      tag: s.tagName.toLowerCase(),
      classes: s.className.trim(),
      id: s.id || null,
    }));

    // Body text content (inner text of main)
    const main = document.querySelector('main') ?? document.body;
    results.bodyText = main.innerText.replace(/\s+/g, ' ').trim().substring(0, 2000);

    // Background color classes
    results.backgroundClasses = Array.from(
      document.querySelectorAll('[class*="background"], [class*="bg-"], [class*="lightgray"], [class*="gray"], [class*="green"], [class*="white"], [class*="blue"]')
    ).map((el) => ({ tag: el.tagName.toLowerCase(), classes: el.className.trim() }));

    // Panel titles
    results.panelTitles = Array.from(document.querySelectorAll('.panel__title, [class*="panel-title"], [class*="panel__title"]')).map((el) => ({
      text: el.textContent.trim(),
      classes: el.className.trim(),
      visible: el.offsetParent !== null,
    }));

    // --- Building-specific structural checks ---

    // Hero: .main__hero.hero with data-spy-viewport
    const heroEl = document.querySelector('.main__hero.hero');
    results.hero = {
      present: !!heroEl,
      hasDataSpyViewport: heroEl ? heroEl.hasAttribute('data-spy-viewport') : false,
    };

    // Hero image: .hero__image
    const heroImgEl = document.querySelector('.hero__image');
    results.heroImage = {
      present: !!heroImgEl,
      srcNonEmpty: heroImgEl ? (heroImgEl.getAttribute('src') ?? '').trim().length > 0 : false,
    };

    // Dynamic zone blocks: .section wrappers
    const sectionEls = Array.from(document.querySelectorAll('.section'));
    results.dynamicZoneSections = {
      count: sectionEls.length,
      classes: sectionEls.map((s) => s.className.trim()),
    };

    // Building items: .building divs with --right or --left modifiers
    const buildingEls = Array.from(document.querySelectorAll('[class*="building"]'));
    const buildingItems = buildingEls.filter((el) => {
      const cls = el.className.trim();
      return /\bbuilding--right\b|\bbuilding--left\b/.test(cls);
    });
    results.buildingItems = {
      count: buildingItems.length,
      items: buildingItems.map((el) => ({ classes: el.className.trim() })),
    };

    // Partners section
    const partnersEl = document.querySelector('.partners');
    results.partners = {
      present: !!partnersEl,
    };

    // Language switcher — look for EN/FR/NL nav links
    const langLinks = Array.from(document.querySelectorAll(
      '[class*="lang"], [class*="language"], nav a[href*="/en/"], nav a[href*="/fr/"], nav a[href*="/nl/"]'
    ));
    results.langSwitcher = langLinks.map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: el.textContent.trim(),
      href: el.getAttribute('href'),
      classes: el.className.trim(),
    }));

    // All unique class names (for BEM diff)
    results.uniqueClasses = [...new Set(allClasses.map((e) => e.classes.split(' ')).flat())].sort();

    return results;
  });
}

function diffPixels(prodPath, localPath, diffPath) {
  const prodImg = PNG.sync.read(fs.readFileSync(prodPath));
  const localImg = PNG.sync.read(fs.readFileSync(localPath));

  // Resize to match (use min dimensions)
  const width = Math.min(prodImg.width, localImg.width);
  const height = Math.min(prodImg.height, localImg.height);

  const diff = new PNG({ width, height });

  const prodData = prodImg.width === width && prodImg.height === height
    ? prodImg.data
    : cropPNG(prodImg, width, height);
  const localData = localImg.width === width && localImg.height === height
    ? localImg.data
    : cropPNG(localImg, width, height);

  const numDiffPixels = pixelmatch(prodData, localData, diff.data, width, height, {
    threshold: 0.1,
    includeAA: false,
  });

  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  const totalPixels = width * height;
  const diffPercent = (numDiffPixels / totalPixels) * 100;
  return { numDiffPixels, totalPixels, diffPercent };
}

function cropPNG(img, width, height) {
  const cropped = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * img.width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      cropped[dstIdx] = img.data[srcIdx];
      cropped[dstIdx + 1] = img.data[srcIdx + 1];
      cropped[dstIdx + 2] = img.data[srcIdx + 2];
      cropped[dstIdx + 3] = img.data[srcIdx + 3];
    }
  }
  return cropped;
}

function diffArrays(label, prodArr, localArr, keyFn) {
  const findings = [];
  const prodKeys = prodArr.map(keyFn);
  const localKeys = localArr.map(keyFn);
  const onlyInProd = prodKeys.filter((k) => !localKeys.includes(k));
  const onlyInLocal = localKeys.filter((k) => !prodKeys.includes(k));
  if (onlyInProd.length) findings.push(`  MISSING in local: ${JSON.stringify(onlyInProd)}`);
  if (onlyInLocal.length) findings.push(`  EXTRA in local: ${JSON.stringify(onlyInLocal)}`);
  return findings;
}

async function checkLocale(browser, localeInfo, report) {
  const { locale, prod: prodPath, local: localPath } = localeInfo;
  const prodUrl = PROD_BASE + prodPath;
  const localUrl = LOCAL_BASE + localPath;

  console.log(`\n=== Checking locale: ${locale} ===`);
  const localFindings = [];

  for (const viewport of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const prodPage = await ctx.newPage();
    const localPage = await ctx.newPage();

    // Navigate
    let prodStatus, localStatus;
    try {
      const prodResp = await prodPage.goto(prodUrl, { waitUntil: 'networkidle', timeout: 30000 });
      prodStatus = prodResp?.status();
    } catch (e) {
      localFindings.push(`FATAL: production page failed to load: ${e.message}`);
      await ctx.close();
      continue;
    }

    try {
      const localResp = await localPage.goto(localUrl, { waitUntil: 'networkidle', timeout: 30000 });
      localStatus = localResp?.status();
    } catch (e) {
      localFindings.push(`FATAL: local page failed to load: ${e.message}`);
      await ctx.close();
      continue;
    }

    if (prodStatus !== 200) localFindings.push(`Production returned HTTP ${prodStatus}`);
    if (localStatus !== 200) localFindings.push(`Local returned HTTP ${localStatus}`);

    // Screenshots
    const prodScreenPath = path.join(SCREENSHOTS_DIR, `${locale}-${viewport.name}-prod.png`);
    const localScreenPath = path.join(SCREENSHOTS_DIR, `${locale}-${viewport.name}-local.png`);
    const diffScreenPath = path.join(SCREENSHOTS_DIR, `${locale}-${viewport.name}-diff.png`);

    await prodPage.screenshot({ path: prodScreenPath, fullPage: true });
    await localPage.screenshot({ path: localScreenPath, fullPage: true });

    // Pixel diff
    const pixelResult = diffPixels(prodScreenPath, localScreenPath, diffScreenPath);
    const pass = pixelResult.diffPercent <= PIXEL_THRESHOLD * 100;
    console.log(`  [${viewport.name}] pixel diff: ${pixelResult.diffPercent.toFixed(2)}% — ${pass ? 'PASS' : 'FAIL'}`);
    if (!pass) {
      localFindings.push(`Visual diff FAIL at ${viewport.name}: ${pixelResult.diffPercent.toFixed(2)}% pixels differ (threshold ${PIXEL_THRESHOLD * 100}%)`);
    }

    // Structural/meta checks on desktop only
    if (viewport.name === 'desktop') {
      const [prodMeta, localMeta] = await Promise.all([extractMeta(prodPage), extractMeta(localPage)]);
      const [prodStruct, localStruct] = await Promise.all([extractStructure(prodPage), extractStructure(localPage)]);

      // --- META checks ---
      if (!localMeta.title || localMeta.title.trim() === '') {
        localFindings.push('META: <title> is empty');
      } else if (prodMeta.title !== localMeta.title) {
        localFindings.push(`META: <title> mismatch\n    prod:  "${prodMeta.title}"\n    local: "${localMeta.title}"`);
      }

      if (!localMeta.description || localMeta.description.trim() === '') {
        localFindings.push('META: meta description is empty');
      } else if (prodMeta.description !== localMeta.description) {
        localFindings.push(`META: description mismatch\n    prod:  "${prodMeta.description}"\n    local: "${localMeta.description}"`);
      }

      // Hreflang check
      const prodHreflangs = prodMeta.hreflangs.map((h) => h.hreflang).sort();
      const localHreflangs = localMeta.hreflangs.map((h) => h.hreflang).sort();
      if (prodHreflangs.length === 0 && localHreflangs.length === 0) {
        localFindings.push('META: hreflang tags absent on both prod and local');
      } else if (JSON.stringify(prodHreflangs) !== JSON.stringify(localHreflangs)) {
        localFindings.push(`META: hreflang mismatch\n    prod:  ${JSON.stringify(prodHreflangs)}\n    local: ${JSON.stringify(localHreflangs)}`);
      }

      // --- STRUCTURE checks ---

      // Headings
      const headingFindings = diffArrays('headings', prodStruct.headings, localStruct.headings, (h) => `${h.tag}:${h.text.substring(0, 80)}`);
      if (headingFindings.length) localFindings.push(`STRUCTURE: heading mismatch:\n${headingFindings.join('\n')}`);

      // Sections / panels
      const sectionFindings = diffArrays('sections', prodStruct.sections, localStruct.sections, (s) => `${s.tag}:${s.classes}`);
      if (sectionFindings.length) localFindings.push(`STRUCTURE: section/panel class mismatch:\n${sectionFindings.join('\n')}`);

      // BEM class names — report prod classes missing from local
      const missingClasses = prodStruct.uniqueClasses.filter(
        (cls) => !localStruct.uniqueClasses.includes(cls) && cls.length > 2
      );
      const extraClasses = localStruct.uniqueClasses.filter(
        (cls) => !prodStruct.uniqueClasses.includes(cls) && cls.length > 2
      );

      // Filter to building/content-relevant BEM classes
      const relevantMissing = missingClasses.filter((c) =>
        /panel|paragraph|building|partners|hero|text|title|background|content|section|block|show|image|slider/.test(c)
      );
      const relevantExtra = extraClasses.filter((c) =>
        /panel|paragraph|building|partners|hero|text|title|background|content|section|block|show|image|slider/.test(c)
      );

      if (relevantMissing.length) {
        localFindings.push(`CSS CLASSES: prod classes MISSING from local:\n  ${relevantMissing.join('\n  ')}`);
      }
      if (relevantExtra.length) {
        localFindings.push(`CSS CLASSES: EXTRA classes in local (not in prod):\n  ${relevantExtra.join('\n  ')}`);
      }

      // Panel titles visible
      if (prodStruct.panelTitles.length && !localStruct.panelTitles.length) {
        localFindings.push('STRUCTURE: panel titles present on prod but absent on local');
      }

      // Content spot-check: first 300 chars of body text
      const prodText = prodStruct.bodyText.substring(0, 300).replace(/\s+/g, ' ');
      const localText = localStruct.bodyText.substring(0, 300).replace(/\s+/g, ' ');
      if (prodText !== localText) {
        localFindings.push(`CONTENT: body text mismatch (first 300 chars)\n    prod:  "${prodText}"\n    local: "${localText}"`);
      }

      // --- BUILDING-SPECIFIC checks ---

      // 1. Hero presence: .main__hero.hero with data-spy-viewport
      if (!localStruct.hero.present) {
        localFindings.push('HERO: .main__hero.hero element is absent');
      } else if (!localStruct.hero.hasDataSpyViewport) {
        localFindings.push('HERO: .main__hero.hero missing data-spy-viewport attribute');
      }

      // 2. Hero image: .hero__image with non-empty src
      if (!localStruct.heroImage.present) {
        localFindings.push('HERO: .hero__image element is absent');
      } else if (!localStruct.heroImage.srcNonEmpty) {
        localFindings.push('HERO: .hero__image src attribute is empty');
      }

      // 3. Dynamic zone blocks: at least 2 .section wrappers
      if (localStruct.dynamicZoneSections.count < 2) {
        localFindings.push(`BLOCKS: expected at least 2 .section wrappers, found ${localStruct.dynamicZoneSections.count}`);
      } else {
        console.log(`  [desktop] .section blocks found: ${localStruct.dynamicZoneSections.count}`);
      }

      // 4. Building items: .building--right or .building--left divs
      if (localStruct.buildingItems.count === 0) {
        localFindings.push('BUILDING ITEMS: no .building--right or .building--left elements found');
      } else {
        console.log(`  [desktop] building item divs found: ${localStruct.buildingItems.count}`);
      }

      // 5. Partners section
      if (!localStruct.partners.present) {
        localFindings.push('PARTNERS: .partners element is absent');
      }

      // 6. Lang switcher: EN/FR/NL must point to /en/building, /fr/building, /nl/building
      const expectedLangHrefs = {
        en: `/${locale === 'en' ? 'en' : locale}/building`,
        fr: '/fr/building',
        nl: '/nl/building',
      };
      // Build a map of lang switcher hrefs from local
      const localLangHrefMap = {};
      for (const link of localStruct.langSwitcher) {
        const href = link.href ?? '';
        if (/\/en\//.test(href)) localLangHrefMap['en'] = href;
        if (/\/fr\//.test(href)) localLangHrefMap['fr'] = href;
        if (/\/nl\//.test(href)) localLangHrefMap['nl'] = href;
      }

      for (const [lang, expectedPattern] of Object.entries({
        en: '/en/building',
        fr: '/fr/building',
        nl: '/nl/building',
      })) {
        const found = localLangHrefMap[lang];
        if (!found) {
          localFindings.push(`LANG SWITCHER: no href found for locale "${lang}"`);
        } else if (!found.toLowerCase().includes(expectedPattern.toLowerCase())) {
          localFindings.push(`LANG SWITCHER: "${lang}" link points to "${found}" — expected to contain "${expectedPattern}"`);
        }
      }

      // Save raw data for debugging
      const debugPath = path.join(SCREENSHOTS_DIR, `${locale}-debug.json`);
      fs.writeFileSync(debugPath, JSON.stringify({ prodMeta, localMeta, prodStruct, localStruct }, null, 2));
    }

    await ctx.close();
  }

  report[locale] = {
    pass: localFindings.length === 0,
    findings: localFindings,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const report = {};

  for (const localeInfo of LOCALES) {
    await checkLocale(browser, localeInfo, report);
  }

  await browser.close();

  // Print report
  console.log('\n\n========================================');
  console.log('BUILDING PARITY REPORT');
  console.log('========================================');

  let overallPass = true;
  for (const [locale, result] of Object.entries(report)) {
    const status = result.pass ? 'PASS' : 'FAIL';
    console.log(`\n[${locale}] ${status}`);
    if (result.findings.length) {
      overallPass = false;
      for (const f of result.findings) {
        console.log(`  - ${f}`);
      }
    }
  }

  console.log('\n========================================');
  console.log(`OVERALL: ${overallPass ? 'PASS' : 'FAIL'}`);
  console.log('========================================');

  // Write JSON report
  const reportPath = path.join(SCREENSHOTS_DIR, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), locales: report }, null, 2));
  console.log(`\nReport written to: ${reportPath}`);
  console.log(`Screenshots in:    ${SCREENSHOTS_DIR}`);

  process.exit(overallPass ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
