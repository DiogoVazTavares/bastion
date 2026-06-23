#!/usr/bin/env node
/**
 * Accommodation page parity check — issue #20
 * Checks: URL presence, block order, slider interactivity, floors lightbox,
 * lightbox URL deep-link behaviour, non-localised fields, visual diff, meta.
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
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots', 'accommodation');

const LOCALES = [
  { locale: 'en', prod: '/en/Accommodation', local: '/en/accommodation' },
  { locale: 'fr', prod: '/fr/Accommodation', local: '/fr/accommodation' },
  { locale: 'nl', prod: '/nl/Accommodation', local: '/nl/accommodation' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 812 },
];

const PIXEL_THRESHOLD = 0.05; // 5%

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function extractMeta(page) {
  return page.evaluate(() => {
    const getMeta = (sel) => document.querySelector(sel)?.getAttribute('content') ?? null;
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
    const coerceClass = (el) =>
      (typeof el.className === 'string' ? el.className : String(el.className.baseVal || '')).trim();

    const allClasses = Array.from(document.querySelectorAll('[class]'))
      .map((el) => ({ tag: el.tagName.toLowerCase(), classes: coerceClass(el) }))
      .filter((e) => e.classes.length > 0);

    const results = {};

    results.headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => ({
      tag: h.tagName.toLowerCase(),
      text: h.textContent.trim(),
      classes: coerceClass(h),
    }));

    // .section wrappers — block containers
    const sectionEls = Array.from(document.querySelectorAll('.section'));
    results.sectionCount = sectionEls.length;
    results.sectionClasses = sectionEls.map((s) => coerceClass(s));

    // Section titles (the block labels)
    results.sectionTitles = Array.from(
      document.querySelectorAll('[class*="section__title"]')
    ).map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: el.textContent.trim(),
    }));

    // Block presence
    results.hasHero = !!document.querySelector('.main__hero.hero, .hero');
    results.heroImageSrc = document.querySelector('.hero__image')?.getAttribute('src') ?? null;
    results.hasSlider = !!document.querySelector('.slider');
    results.sliderSlideCount = document.querySelectorAll('[data-behavior="slider-slide"]').length;
    results.sliderPrev = !!document.querySelector('[data-behavior="slider-previous"]');
    results.sliderNext = !!document.querySelector('[data-behavior="slider-next"]');
    results.sliderNavDots = document.querySelectorAll('[data-behavior="slider-nav-item"]').length;
    results.hasFloors = !!document.querySelector('[data-behavior="floors"]');
    results.floorsLightboxCount = document.querySelectorAll('.floors__lightboxes [data-lightbox-id]').length;
    results.floorUids = Array.from(
      document.querySelectorAll('.floors__lightboxes [data-lightbox-id]')
    ).map((el) => el.getAttribute('data-lightbox-id'));
    results.hasParagraph = !!document.querySelector('.paragraph');
    results.hasInfo = !!document.querySelector('.info');

    // FIX-5: Slider figcaptions (main gallery slider only, not lightbox slides)
    const mainSlider = document.querySelector('.slider[data-behavior="slider"], .slider.our-slider');
    if (mainSlider) {
      results.sliderFigcaptions = Array.from(
        mainSlider.querySelectorAll('.slider__slide-figcaption')
      ).map((el) => el.textContent.trim());
    } else {
      // Slider may already be initialised (our-slider class added, data-behavior removed)
      const sliderEl = document.querySelector('.slider');
      results.sliderFigcaptions = sliderEl
        ? Array.from(sliderEl.querySelectorAll('.slider__slide-figcaption')).map((el) => el.textContent.trim())
        : [];
    }

    // FIX-4: Info blocks — collect each info block's section title (or null if hidden)
    results.infoBlocks = Array.from(document.querySelectorAll('.section .info')).map((infoEl) => {
      const section = infoEl.closest('.section');
      const titleEl = section ? section.querySelector('.section__title') : null;
      return {
        title: titleEl ? titleEl.textContent.trim() : null,
        itemCount: infoEl.querySelectorAll('.info__item').length,
        hasImages: infoEl.querySelectorAll('.info__image img').length > 0,
        imageSrcs: Array.from(infoEl.querySelectorAll('.info__image img')).map((img) => img.getAttribute('src')),
      };
    });

    // FIX-3: Floors section wrapper — check .section.section__inner wraps the floors element
    const floorsEl = document.querySelector('[data-behavior="floors"]');
    results.floorsSectionWrapper = floorsEl
      ? !!floorsEl.closest('.section')
      : false;
    results.floorsHasSectionInner = floorsEl
      ? !!floorsEl.closest('.section__inner')
      : false;

    // Block order via first BEM class presence — exclude elements inside .floors__lightboxes[hidden]
    const blockOrder = [];
    Array.from(document.querySelectorAll('[class]')).forEach((el) => {
      // Skip anything inside the hidden lightbox templates — they're not rendered blocks
      if (el.closest('.floors__lightboxes')) return;
      const cls = coerceClass(el);
      if (/\bparagraph\b/.test(cls) && blockOrder[blockOrder.length - 1] !== 'paragraph') blockOrder.push('paragraph');
      else if (/\bslider\b/.test(cls) && !/slider__/.test(cls) && blockOrder[blockOrder.length - 1] !== 'slider') blockOrder.push('slider');
      else if (/\bfloors\b/.test(cls) && !/floors__/.test(cls) && blockOrder[blockOrder.length - 1] !== 'floors') blockOrder.push('floors');
      else if (/\binfo\b/.test(cls) && !/info__/.test(cls) && blockOrder[blockOrder.length - 1] !== 'info') blockOrder.push('info');
    });
    results.blockOrder = blockOrder;

    // Language switcher
    results.langLinks = Array.from(
      document.querySelectorAll('[class*="lang"] a, nav a[href*="/en/"], nav a[href*="/fr/"], nav a[href*="/nl/"]')
    ).map((el) => ({ href: el.getAttribute('href'), text: el.textContent.trim(), classes: coerceClass(el) }));

    results.uniqueClasses = [...new Set(allClasses.map((e) => e.classes.split(' ')).flat())].sort();

    return results;
  });
}

function diffPixels(prodPath, localPath, diffPath) {
  const prodImg = PNG.sync.read(fs.readFileSync(prodPath));
  const localImg = PNG.sync.read(fs.readFileSync(localPath));

  const width = Math.min(prodImg.width, localImg.width);
  const height = Math.min(prodImg.height, localImg.height);
  const diff = new PNG({ width, height });

  const prodData = prodImg.width === width && prodImg.height === height ? prodImg.data : cropPNG(prodImg, width, height);
  const localData = localImg.width === width && localImg.height === height ? localImg.data : cropPNG(localImg, width, height);

  const numDiffPixels = pixelmatch(prodData, localData, diff.data, width, height, { threshold: 0.1, includeAA: false });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  const totalPixels = width * height;
  return { numDiffPixels, totalPixels, diffPercent: (numDiffPixels / totalPixels) * 100 };
}

function cropPNG(img, width, height) {
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * img.width + x) * 4;
      const di = (y * width + x) * 4;
      out[di] = img.data[si]; out[di+1] = img.data[si+1]; out[di+2] = img.data[si+2]; out[di+3] = img.data[si+3];
    }
  }
  return out;
}

// ── FIX-2: Lightbox slider prev/next navigation ────────────────────────────────
async function testLightboxSliderNavigation(browser, locale, floorUid, findings) {
  console.log(`  [fix2-lightbox-nav] testing lightbox prev/next for ${locale}/${floorUid}`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const pageUrl = `${LOCAL_BASE}/${locale}/accommodation`;
  await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

  // Open the lightbox via the trigger
  const trigger = page.locator(`[data-behavior="lightbox"][data-lightbox-suffix="${floorUid}"]`).first();
  if (await trigger.count() === 0) {
    findings.push(`FIX-2: no lightbox trigger for uid=${floorUid} on ${locale}`);
    await ctx.close();
    return;
  }
  await trigger.click();
  await page.waitForTimeout(600); // let the lightbox init + slider Discover()

  // Verify the lightbox is open
  const container = page.locator('.our-lightbox__container');
  if (await container.count() === 0) {
    findings.push(`FIX-2: lightbox did not open for uid=${floorUid} on ${locale}`);
    await ctx.close();
    return;
  }

  // Count slides in the lightbox slider
  const slideCount = await page.locator('.our-lightbox__container [data-behavior="slider-slide"], .our-lightbox__container .our-slider__slide').count();
  console.log(`    lightbox slide count: ${slideCount}`);

  if (slideCount < 2) {
    // Only 1 image — prev/next arrows not rendered; this is expected
    findings.push(`FIX-2 (info): uid=${floorUid} has only ${slideCount} slide(s) — prev/next not rendered (expected)`);
    await ctx.close();
    return;
  }

  // Check: does the cloned slider still have data-behavior="slider"?
  // If BaseLayout initSlider stripped it from the template, the clone won't have it either,
  // so DiscoverSliders() will skip it and prev/next listeners will never be attached.
  const clonedSliderHasDataBehavior = await page.locator('.our-lightbox__container .lightbox__inner').evaluate(
    (el) => el.hasAttribute('data-behavior')
  );
  console.log(`    cloned slider has data-behavior: ${clonedSliderHasDataBehavior}`);
  if (!clonedSliderHasDataBehavior) {
    findings.push(`FIX-2: FAIL — cloned lightbox slider has NO data-behavior="slider" (BaseLayout.initSlider stripped it from template before clone). DiscoverSliders() cannot initialize it → prev/next listeners absent. Root cause: BaseLayout.astro is:inline initSlider lacks [hidden] guard.`);
    await ctx.close();
    return;
  }

  // Grab transform state before click
  const slidesWrapper = page.locator('.our-lightbox__container [data-behavior="slider-slides"], .our-lightbox__container .our-slider__slides').first();
  const transformBefore = await slidesWrapper.evaluate((el) => el.style.transform);
  console.log(`    transform before next: "${transformBefore}"`);

  // Click Next — use force:true because lightbox slides can visually overlay the arrows
  // (the slides have full-width coverage; in production users click the visible icon area
  // which protrudes, but headless Playwright needs force to dispatch the event to the <a>).
  const nextBtn = page.locator('.our-lightbox__container [data-behavior="slider-next"]').first();
  const nextBtnCount = await nextBtn.count();
  if (nextBtnCount === 0) {
    findings.push(`FIX-2: FAIL — no [data-behavior="slider-next"] in lightbox container for ${locale}/${floorUid}`);
    await ctx.close();
    return;
  }
  await nextBtn.click({ force: true });
  await page.waitForTimeout(400);
  const transformAfterNext = await slidesWrapper.evaluate((el) => el.style.transform);
  console.log(`    transform after next:  "${transformAfterNext}"`);

  if (transformAfterNext === transformBefore) {
    findings.push(`FIX-2: FAIL — next arrow did NOT change slider transform on ${locale}/${floorUid} (before="${transformBefore}", after="${transformAfterNext}")`);
  } else {
    console.log(`    next arrow: PASS (transform changed)`);
  }

  // Click Previous — should go back
  const prevBtn = page.locator('.our-lightbox__container [data-behavior="slider-previous"]').first();
  if (await prevBtn.count() === 0) {
    findings.push(`FIX-2: FAIL — no [data-behavior="slider-previous"] in lightbox container for ${locale}/${floorUid}`);
    await ctx.close();
    return;
  }
  await prevBtn.click({ force: true });
  await page.waitForTimeout(400);
  const transformAfterPrev = await slidesWrapper.evaluate((el) => el.style.transform);
  console.log(`    transform after prev:  "${transformAfterPrev}"`);

  if (transformAfterPrev === transformAfterNext) {
    findings.push(`FIX-2: FAIL — prev arrow did NOT change slider transform on ${locale}/${floorUid}`);
  } else {
    console.log(`    prev arrow: PASS (transform changed back)`);
  }

  // Screenshot
  const navScreenPath = `${__dirname}/screenshots/accommodation/${locale}-lightbox-nav.png`;
  await page.screenshot({ path: navScreenPath, fullPage: false });

  await ctx.close();
}

// ── FIX-1: Lightbox popstate back/forward ──────────────────────────────────────
async function testLightboxPopstate(browser, locale, floorUid, findings) {
  console.log(`  [fix1-popstate] testing popstate for ${locale}/${floorUid}`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const pageUrl = `${LOCAL_BASE}/${locale}/accommodation`;
  await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

  const trigger = page.locator(`[data-behavior="lightbox"][data-lightbox-suffix="${floorUid}"]`).first();
  if (await trigger.count() === 0) {
    findings.push(`FIX-1 popstate: no trigger for uid=${floorUid} on ${locale}`);
    await ctx.close();
    return;
  }

  // Open lightbox (pushState adds /{uid})
  await trigger.click();
  await page.waitForTimeout(400);
  const urlAfterOpen = page.url();
  const openOk = urlAfterOpen.includes(`/${locale}/accommodation/${floorUid}`);
  console.log(`    URL after open: ${urlAfterOpen} → ${openOk ? 'OK' : 'FAIL'}`);

  // Browser back — should pop URL and close lightbox
  await page.goBack();
  await page.waitForTimeout(400);
  const urlAfterBack = page.url();
  const backUrlOk = urlAfterBack.endsWith(`/${locale}/accommodation`) || urlAfterBack.endsWith(`/${locale}/accommodation/`);
  const lightboxAfterBack = await page.locator('.our-lightbox__container').count();
  console.log(`    URL after back: ${urlAfterBack} → ${backUrlOk ? 'OK' : 'FAIL'}`);
  console.log(`    Lightbox open after back: ${lightboxAfterBack > 0}`);

  if (!backUrlOk) {
    findings.push(`FIX-1 popstate: back did not restore base URL — got "${urlAfterBack}"`);
  }
  if (lightboxAfterBack > 0) {
    findings.push(`FIX-1 popstate: lightbox still open after browser back on ${locale}`);
  }

  // Browser forward — should push URL and re-open lightbox
  await page.goForward();
  await page.waitForTimeout(400);
  const urlAfterForward = page.url();
  const forwardUrlOk = urlAfterForward.includes(`/${locale}/accommodation/${floorUid}`);
  const lightboxAfterForward = await page.locator('.our-lightbox__container').count();
  console.log(`    URL after forward: ${urlAfterForward} → ${forwardUrlOk ? 'OK' : 'FAIL'}`);
  console.log(`    Lightbox open after forward: ${lightboxAfterForward > 0}`);

  if (!forwardUrlOk) {
    findings.push(`FIX-1 popstate: forward did not restore uid URL — got "${urlAfterForward}"`);
  }
  if (lightboxAfterForward === 0) {
    findings.push(`FIX-1 popstate: lightbox did NOT re-open after browser forward on ${locale}`);
  }

  await ctx.close();
}

// ── Lightbox URL behaviour test ────────────────────────────────────────────────
async function testLightboxUrlBehaviour(browser, locale, floorUid, findings) {
  console.log(`  [lightbox-url] testing ${locale}/accommodation with uid=${floorUid}`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const pageUrl = `${LOCAL_BASE}/${locale}/accommodation`;
  await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

  const urlBefore = page.url();

  // Click the SVG rect (lightbox trigger) for this floor uid
  const trigger = page.locator(`[data-behavior="lightbox"][data-lightbox-suffix="${floorUid}"]`).first();
  const triggerCount = await trigger.count();
  if (triggerCount === 0) {
    findings.push(`LIGHTBOX URL: no [data-behavior="lightbox"][data-lightbox-suffix="${floorUid}"] trigger found on ${locale}`);
    await ctx.close();
    return;
  }

  await trigger.click();

  // Wait for URL change (up to 2s)
  let urlAfterOpen = '';
  try {
    await page.waitForFunction(
      (orig) => window.location.href !== orig,
      urlBefore,
      { timeout: 2000 }
    );
    urlAfterOpen = page.url();
  } catch {
    urlAfterOpen = page.url();
  }

  const expectedOpenPath = `/${locale}/accommodation/${floorUid}`;
  const openOk = urlAfterOpen.includes(expectedOpenPath);
  console.log(`    open URL:  ${urlAfterOpen}`);
  if (!openOk) {
    findings.push(`LIGHTBOX URL: open did not append /${floorUid} — got "${urlAfterOpen}", expected path "${expectedOpenPath}"`);
  }

  // Close via close button — must target the live container, not the hidden template
  const closeBtn = page.locator('.our-lightbox__container [data-behavior="lightbox-close"]').first();
  const closeBtnFallback = page.locator('.our-lightbox__container .lightbox__close').first();
  const closeBtnCount = await closeBtn.count();
  const closeFallbackCount = await closeBtnFallback.count();
  if (closeBtnCount === 0 && closeFallbackCount === 0) {
    findings.push(`LIGHTBOX URL: no close button found in .our-lightbox__container after opening ${locale}/${floorUid}`);
    await ctx.close();
    return;
  }
  const activeCloseBtn = closeBtnCount > 0 ? closeBtn : closeBtnFallback;
  await activeCloseBtn.click({ force: true });

  let urlAfterClose = '';
  try {
    await page.waitForFunction(
      (open) => window.location.href !== open,
      urlAfterOpen,
      { timeout: 2000 }
    );
    urlAfterClose = page.url();
  } catch {
    urlAfterClose = page.url();
  }

  const expectedClosePath = `/${locale}/accommodation`;
  const closeOk = urlAfterClose.replace(/\/$/, '').endsWith(expectedClosePath);
  console.log(`    close URL: ${urlAfterClose}`);
  if (!closeOk) {
    findings.push(`LIGHTBOX URL: close did not restore base path — got "${urlAfterClose}", expected "${expectedClosePath}"`);
  }

  // Take screenshot of open lightbox
  await trigger.click();
  await page.waitForTimeout(500);
  const lbScreenPath = path.join(SCREENSHOTS_DIR, `${locale}-desktop-lightbox-open.png`);
  await page.screenshot({ path: lbScreenPath, fullPage: false });
  console.log(`    lightbox screenshot: ${lbScreenPath}`);

  await ctx.close();
}

// ── Deep-link cold-load test ───────────────────────────────────────────────────
async function testDeepLinkColdLoad(browser, locale, floorUid, findings) {
  console.log(`  [deep-link] cold load ${locale}/accommodation/${floorUid}`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const deepUrl = `${LOCAL_BASE}/${locale}/accommodation/${floorUid}`;
  const resp = await page.goto(deepUrl, { waitUntil: 'networkidle', timeout: 30000 });
  const status = resp?.status();

  if (status !== 200) {
    findings.push(`DEEP LINK: ${deepUrl} returned HTTP ${status}`);
    await ctx.close();
    return;
  }

  // Check autoOpenUid attribute
  const autoUid = await page.getAttribute('[data-behavior="floors"]', 'data-autoopen-uid');
  if (autoUid !== floorUid) {
    findings.push(`DEEP LINK: data-autoopen-uid="${autoUid}" — expected "${floorUid}"`);
  }

  // Check that the lightbox opens automatically
  await page.waitForTimeout(800); // give the island script time to run
  const lightboxVisible = await page.locator('.our-lightbox__container').count();
  if (lightboxVisible === 0) {
    findings.push(`DEEP LINK: lightbox did NOT auto-open on cold load of ${deepUrl}`);
  } else {
    console.log(`    lightbox auto-opened: YES`);
  }

  // The URL should already have the uid — no extra push
  const currentUrl = page.url();
  const expectedPath = `/${locale}/accommodation/${floorUid}`;
  if (!currentUrl.includes(expectedPath)) {
    findings.push(`DEEP LINK: URL after cold load was "${currentUrl}" — expected to contain "${expectedPath}"`);
  }

  const dlScreenPath = path.join(SCREENSHOTS_DIR, `${locale}-desktop-deeplink-${floorUid}.png`);
  await page.screenshot({ path: dlScreenPath, fullPage: false });
  console.log(`    deep-link screenshot: ${dlScreenPath}`);

  await ctx.close();
}

// ── Live-site lightbox URL test (observe only, no writes) ─────────────────────
async function observeLiveLightboxUrl(browser, locale, floorUid, findings) {
  console.log(`  [live-lightbox-url] observing live ${locale}/Accommodation uid=${floorUid}`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const liveUrl = `${PROD_BASE}/${locale}/Accommodation`;
  try {
    await page.goto(liveUrl, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    findings.push(`LIVE LIGHTBOX OBSERVE: failed to load ${liveUrl}: ${e.message}`);
    await ctx.close();
    return;
  }

  const urlBefore = page.url();
  const trigger = page.locator(`[data-behavior="lightbox"][data-lightbox-suffix="${floorUid}"]`).first();
  if (await trigger.count() === 0) {
    findings.push(`LIVE LIGHTBOX OBSERVE: trigger not found for uid=${floorUid} on live ${locale}`);
    await ctx.close();
    return;
  }

  await trigger.click();
  let urlAfterOpen = urlBefore;
  try {
    await page.waitForFunction((orig) => window.location.href !== orig, urlBefore, { timeout: 3000 });
    urlAfterOpen = page.url();
  } catch {
    urlAfterOpen = page.url();
  }

  console.log(`    live open URL: ${urlAfterOpen}`);

  // Record for comparison report — this is purely observational
  findings.push(`LIVE LIGHTBOX OBSERVE (info): live open URL = "${urlAfterOpen}"`);

  await ctx.close();
}

// ── Per-locale check ─────────────────────────────────────────────────────────
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

    let prodStatus, localStatus;
    try {
      const r = await prodPage.goto(prodUrl, { waitUntil: 'networkidle', timeout: 30000 });
      prodStatus = r?.status();
    } catch (e) {
      localFindings.push(`FATAL: prod load failed: ${e.message}`);
      await ctx.close();
      continue;
    }
    try {
      const r = await localPage.goto(localUrl, { waitUntil: 'networkidle', timeout: 30000 });
      localStatus = r?.status();
    } catch (e) {
      localFindings.push(`FATAL: local load failed: ${e.message}`);
      await ctx.close();
      continue;
    }

    if (prodStatus !== 200) localFindings.push(`Prod returned HTTP ${prodStatus}`);
    if (localStatus !== 200) localFindings.push(`Local returned HTTP ${localStatus}`);

    const prodScreenPath = path.join(SCREENSHOTS_DIR, `${locale}-${viewport.name}-prod.png`);
    const localScreenPath = path.join(SCREENSHOTS_DIR, `${locale}-${viewport.name}-local.png`);
    const diffScreenPath = path.join(SCREENSHOTS_DIR, `${locale}-${viewport.name}-diff.png`);

    // Mask cookie banner: paint top 50px white on both before diff
    await prodPage.evaluate(() => {
      const mask = document.createElement('div');
      Object.assign(mask.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '50px', background: 'white', zIndex: '99999' });
      document.body.appendChild(mask);
    });

    await prodPage.screenshot({ path: prodScreenPath, fullPage: true });
    await localPage.screenshot({ path: localScreenPath, fullPage: true });

    const pixelResult = diffPixels(prodScreenPath, localScreenPath, diffScreenPath);
    const pass = pixelResult.diffPercent <= PIXEL_THRESHOLD * 100;
    console.log(`  [${viewport.name}] pixel diff: ${pixelResult.diffPercent.toFixed(2)}% — ${pass ? 'PASS' : 'FAIL'}`);
    if (!pass) {
      localFindings.push(`Visual diff FAIL at ${viewport.name}: ${pixelResult.diffPercent.toFixed(2)}% (threshold ${PIXEL_THRESHOLD * 100}%)`);
    }

    if (viewport.name === 'desktop') {
      const [prodMeta, localMeta] = await Promise.all([extractMeta(prodPage), extractMeta(localPage)]);
      const [prodStruct, localStruct] = await Promise.all([extractStructure(prodPage), extractStructure(localPage)]);

      // META
      if (!localMeta.title) localFindings.push('META: <title> empty');
      else if (prodMeta.title !== localMeta.title) {
        // HTML entities vs Unicode — check decoded
        const decode = (s) => s.replace(/&#x2014;/g, '—').replace(/&#xA0;/g, ' ').replace(/&#xA;/g, '\n');
        if (decode(prodMeta.title) !== decode(localMeta.title)) {
          localFindings.push(`META: title mismatch\n    prod:  "${prodMeta.title}"\n    local: "${localMeta.title}"`);
        }
      }

      if (!localMeta.description) localFindings.push('META: description empty');

      if (localMeta.hreflangs.length === 0) {
        localFindings.push('META: hreflang tags ABSENT — SEO gap (prod also absent: ' + (prodMeta.hreflangs.length === 0) + ')');
      }
      if (!localMeta.canonical) {
        localFindings.push('META: canonical tag ABSENT');
      }

      // BLOCK ORDER
      const expectedOrder = ['paragraph', 'slider', 'floors', 'paragraph', 'info'];
      const localOrder = localStruct.blockOrder.filter((b) => expectedOrder.includes(b));
      if (JSON.stringify(localOrder) !== JSON.stringify(expectedOrder)) {
        localFindings.push(`BLOCKS: order mismatch\n    expected: ${JSON.stringify(expectedOrder)}\n    got:      ${JSON.stringify(localOrder)}`);
      } else {
        console.log(`  [desktop] block order: ${localOrder.join(' → ')} ✓`);
      }

      // SECTION TITLES (floors missing its section__title wrapper)
      const prodTitles = prodStruct.sectionTitles.map((t) => t.text);
      const localTitles = localStruct.sectionTitles.map((t) => t.text);
      const missingTitles = prodTitles.filter((t) => !localTitles.includes(t) && t !== 'Contact');
      const extraTitles = localTitles.filter((t) => !prodTitles.includes(t) && t !== 'Contact');
      if (missingTitles.length) localFindings.push(`BLOCKS: section titles missing from local: ${JSON.stringify(missingTitles)}`);
      if (extraTitles.length) localFindings.push(`BLOCKS: extra section titles in local: ${JSON.stringify(extraTitles)}`);

      // SECTION TITLE TAG (should be h1 on live, h4 on local — flag if mismatch matters)
      const localTitleTags = [...new Set(localStruct.sectionTitles.map((t) => t.tag))];
      const prodTitleTags = [...new Set(prodStruct.sectionTitles.map((t) => t.tag))];
      if (JSON.stringify(localTitleTags.sort()) !== JSON.stringify(prodTitleTags.sort())) {
        localFindings.push(`BLOCKS: section__title tag mismatch — prod: ${JSON.stringify(prodTitleTags)}, local: ${JSON.stringify(localTitleTags)}`);
      }

      // SLIDER
      if (!localStruct.hasSlider) localFindings.push('SLIDER: .slider element absent');
      else {
        if (!localStruct.sliderPrev) localFindings.push('SLIDER: prev control absent');
        if (!localStruct.sliderNext) localFindings.push('SLIDER: next control absent');
        if (localStruct.sliderNavDots === 0) localFindings.push('SLIDER: nav dots absent');
        else console.log(`  [desktop] slider slides: ${localStruct.sliderSlideCount}, nav dots: ${localStruct.sliderNavDots} ✓`);
      }

      // FLOORS
      if (!localStruct.hasFloors) localFindings.push('FLOORS: [data-behavior="floors"] absent');
      else console.log(`  [desktop] floors lightbox fragments: ${localStruct.floorsLightboxCount} (uids: ${localStruct.floorUids.join(', ')})`);

      // FIX-3: Floors section wrapper — floor block must be inside .section > .section__inner
      if (localStruct.hasFloors) {
        if (!localStruct.floorsSectionWrapper) {
          localFindings.push('FIX-3 FAIL: floors block has no .section wrapper — section title and spy-enter-viewport transitions absent');
        } else if (!localStruct.floorsHasSectionInner) {
          localFindings.push('FIX-3 FAIL: floors block has .section but no .section__inner wrapper');
        } else {
          console.log(`  [desktop] FIX-3: floors section wrapper present ✓`);
        }
        // Check the floors section title appears in sectionTitles list
        const floorsTitleTexts = ['Schedule of availability', 'Disponibilités', 'Beschikbaarheid'];
        const hasFloorsTitle = localStruct.sectionTitles.some(
          (t) => floorsTitleTexts.includes(t.text)
        );
        if (!hasFloorsTitle) {
          localFindings.push(`FIX-3 FAIL: floors section__title not found in page (expected one of ${JSON.stringify(floorsTitleTexts)})`);
        } else {
          const floorsTitleEl = localStruct.sectionTitles.find((t) => floorsTitleTexts.includes(t.text));
          console.log(`  [desktop] FIX-3: floors section__title "${floorsTitleEl.text}" (${floorsTitleEl.tag}) ✓`);
        }
      }

      // FIX-4: Info block show_title flags.
      // DOM order: index 0 = "Specifications details" (show_title=false → no title, no images)
      //            index 1 = "Other Features" (show_title=true → has title + SVG images)
      if (localStruct.infoBlocks && localStruct.infoBlocks.length >= 2) {
        const specsInfo = localStruct.infoBlocks[0]; // Specifications details
        const featuresInfo = localStruct.infoBlocks[1]; // Other Features
        // Specs block must have NO title (show_title=false)
        if (specsInfo.title) {
          localFindings.push(`FIX-4 FAIL: "Specifications details" info block shows title "${specsInfo.title}" — show_title should be false`);
        } else {
          console.log(`  [desktop] FIX-4: "Specifications details" has no title (show_title=false) ✓`);
        }
        // Features block must have a title (show_title=true)
        if (!featuresInfo.title) {
          localFindings.push('FIX-4 FAIL: "Other Features" info block has no title — show_title should be true');
        } else {
          console.log(`  [desktop] FIX-4: "Other Features" title="${featuresInfo.title}" ✓`);
        }
      } else if (localStruct.infoBlocks) {
        localFindings.push(`FIX-4: expected 2 info blocks, found ${localStruct.infoBlocks.length}`);
      }

      // FIX-5: Slider figcaptions — all 10 gallery slides should have figcaption
      if (localStruct.sliderFigcaptions !== undefined) {
        const captionCount = localStruct.sliderFigcaptions.length;
        const expectedCaptionCount = 10;
        if (captionCount === 0) {
          localFindings.push(`FIX-5 FAIL: no slider figcaptions found — caption field not populated in ETL`);
        } else if (captionCount < expectedCaptionCount) {
          localFindings.push(`FIX-5 FAIL: only ${captionCount}/${expectedCaptionCount} slides have figcaptions`);
        } else {
          // Verify the text matches expected attribution
          const wrongCaptions = localStruct.sliderFigcaptions.filter(
            (c) => !c.includes('Gianluca Di Fabio')
          );
          if (wrongCaptions.length) {
            localFindings.push(`FIX-5 FAIL: ${wrongCaptions.length} figcaptions have unexpected text (expected "© Gianluca Di Fabio Architects")`);
          } else {
            console.log(`  [desktop] FIX-5: all ${captionCount} slider figcaptions present with correct text ✓`);
          }
        }
      }

      // FIX-6: Info SVG icons — "Other Features" block (index 1) should have 3 SVG images
      if (localStruct.infoBlocks && localStruct.infoBlocks.length >= 2) {
        const featuresInfo = localStruct.infoBlocks[1]; // Other Features
        if (!featuresInfo.hasImages) {
          localFindings.push('FIX-6 FAIL: "Other Features" info block has no images — SVG icons missing');
        } else {
          const svgIconCount = featuresInfo.imageSrcs.length;
          const brokenSrcs = featuresInfo.imageSrcs.filter((s) => !s || s.trim() === '');
          console.log(`  [desktop] FIX-6: ${svgIconCount} SVG icons present: ${featuresInfo.imageSrcs.map(s => s.split('/').pop()).join(', ')}`);
          if (brokenSrcs.length) {
            localFindings.push(`FIX-6 FAIL: ${brokenSrcs.length} info images have empty/null src`);
          } else if (svgIconCount !== 3) {
            localFindings.push(`FIX-6: expected 3 SVG icons in "Other Features", found ${svgIconCount}`);
          } else {
            console.log(`  [desktop] FIX-6: all 3 SVG icons present ✓`);
          }
        }
      }

      // LANG SWITCHER
      const localHrefMap = {};
      for (const link of localStruct.langLinks) {
        const href = link.href ?? '';
        if (/\/en\//.test(href)) localHrefMap['en'] = href;
        if (/\/fr\//.test(href)) localHrefMap['fr'] = href;
        if (/\/nl\//.test(href)) localHrefMap['nl'] = href;
      }
      for (const lang of ['en', 'fr', 'nl']) {
        const found = localHrefMap[lang];
        if (!found) localFindings.push(`LANG SWITCHER: no href for locale "${lang}"`);
        else if (!found.toLowerCase().includes(`/${lang}/accommodation`)) {
          localFindings.push(`LANG SWITCHER: "${lang}" link is "${found}" — expected /${lang}/accommodation`);
        }
      }

      // CSS CLASS BEM diff
      const relevantFilter = (c) =>
        /paragraph|slider|floors|info|hero|section|block|title|background|content/.test(c);
      const missingClasses = prodStruct.uniqueClasses.filter(
        (c) => !localStruct.uniqueClasses.includes(c) && c.length > 3 && relevantFilter(c)
      );
      const extraClasses = localStruct.uniqueClasses.filter(
        (c) => !prodStruct.uniqueClasses.includes(c) && c.length > 3 && relevantFilter(c)
      );
      if (missingClasses.length) localFindings.push(`CSS CLASSES: prod classes missing from local:\n  ${missingClasses.join('\n  ')}`);
      if (extraClasses.length) localFindings.push(`CSS CLASSES: extra classes in local (not in prod):\n  ${extraClasses.join('\n  ')}`);

      const debugPath = path.join(SCREENSHOTS_DIR, `${locale}-debug.json`);
      fs.writeFileSync(debugPath, JSON.stringify({ prodMeta, localMeta, prodStruct, localStruct }, null, 2));
    }

    await ctx.close();
  }

  report[locale] = { pass: localFindings.length === 0, findings: localFindings };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const report = {};
  const lightboxFindings = [];
  const deepLinkFindings = [];

  // Core parity checks for each locale
  for (const localeInfo of LOCALES) {
    await checkLocale(browser, localeInfo, report);
  }

  // Lightbox URL behaviour — test en only (same code path for all locales)
  // Get the first floor uid for each locale
  const enUid = '22';       // from earlier curl
  const frUid = 'uid-9b68e793';
  const nlUid = 'uid-c2579ab3';

  console.log('\n=== Lightbox URL behaviour tests (FIX-1) ===');
  // Observe live behaviour first
  await observeLiveLightboxUrl(browser, 'en', enUid, lightboxFindings);
  // Test rebuilt — open/close URL behaviour
  await testLightboxUrlBehaviour(browser, 'en', enUid, lightboxFindings);
  await testLightboxUrlBehaviour(browser, 'fr', frUid, lightboxFindings);
  await testLightboxUrlBehaviour(browser, 'nl', nlUid, lightboxFindings);

  console.log('\n=== Lightbox popstate back/forward (FIX-1) ===');
  const popstatefindings = [];
  await testLightboxPopstate(browser, 'en', enUid, popstatefindings);
  for (const f of popstatefindings) console.log(`  ${f}`);

  console.log('\n=== Lightbox slider prev/next (FIX-2) ===');
  const fix2Findings = [];
  // Use a floor uid that has multiple images; en uid=22 is the first floor — try it,
  // then fall back to a later floor that we know has multiple images.
  // We'll test all three locales' first floor uid.
  await testLightboxSliderNavigation(browser, 'en', enUid, fix2Findings);
  await testLightboxSliderNavigation(browser, 'fr', frUid, fix2Findings);
  await testLightboxSliderNavigation(browser, 'nl', nlUid, fix2Findings);

  console.log('\n=== Deep-link cold-load tests ===');
  await testDeepLinkColdLoad(browser, 'en', enUid, deepLinkFindings);
  await testDeepLinkColdLoad(browser, 'fr', frUid, deepLinkFindings);
  await testDeepLinkColdLoad(browser, 'nl', nlUid, deepLinkFindings);

  await browser.close();

  // Print report
  console.log('\n\n========================================');
  console.log('ACCOMMODATION PARITY REPORT — issue #20');
  console.log('========================================');

  let overallPass = true;

  for (const [locale, result] of Object.entries(report)) {
    const status = result.pass ? 'PASS' : 'FAIL';
    console.log(`\n[${locale}] ${status}`);
    if (result.findings.length) {
      overallPass = false;
      for (const f of result.findings) console.log(`  - ${f}`);
    }
  }

  console.log('\n--- FIX-1: Lightbox URL open/close ---');
  const infoOnly = lightboxFindings.filter((f) => f.startsWith('LIVE LIGHTBOX OBSERVE (info)'));
  const lbFails = lightboxFindings.filter((f) => !f.startsWith('LIVE LIGHTBOX OBSERVE (info)'));
  for (const f of infoOnly) console.log(`  ${f}`);
  if (lbFails.length === 0) console.log('  PASS: open/close URL behaviour correct on all locales');
  for (const f of lbFails) { console.log(`  FAIL: ${f}`); overallPass = false; }

  console.log('\n--- FIX-1: Lightbox popstate back/forward ---');
  const popstateFails = popstatefindings.filter((f) => f.includes('FAIL'));
  if (popstateFails.length === 0 && popstatefindings.length > 0) console.log('  PASS: popstate back/forward correct');
  else if (popstatefindings.length === 0) console.log('  (no popstate findings)');
  for (const f of popstateFails) { console.log(`  FAIL: ${f}`); overallPass = false; }

  console.log('\n--- FIX-2: Lightbox slider prev/next navigation ---');
  const fix2Fails = fix2Findings.filter((f) => f.startsWith('FIX-2: FAIL'));
  const fix2Info = fix2Findings.filter((f) => !f.startsWith('FIX-2: FAIL'));
  for (const f of fix2Info) console.log(`  INFO: ${f}`);
  if (fix2Fails.length === 0) console.log('  PASS: lightbox prev/next arrows navigate correctly');
  for (const f of fix2Fails) { console.log(`  FAIL: ${f}`); overallPass = false; }

  console.log('\n--- Deep-link cold-load ---');
  for (const f of deepLinkFindings) {
    const isFail = !f.startsWith('LIVE');
    console.log(`  ${isFail ? 'FAIL: ' : ''}${f}`);
    if (isFail) overallPass = false;
  }

  console.log('\n========================================');
  console.log(`OVERALL: ${overallPass ? 'PASS' : 'FAIL'}`);
  console.log('========================================');

  const reportData = {
    timestamp: new Date().toISOString(),
    locales: report,
    lightboxUrlBehaviour: { lbFails, infoOnly },
    fix1Popstate: popstatefindings,
    fix2LightboxNav: fix2Findings,
    deepLinkColdLoad: deepLinkFindings,
  };
  const reportPath = path.join(SCREENSHOTS_DIR, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`\nReport: ${reportPath}`);
  console.log(`Screenshots: ${SCREENSHOTS_DIR}`);

  process.exit(overallPass ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
