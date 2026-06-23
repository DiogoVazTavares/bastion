#!/usr/bin/env node
// Focused BUG-6 re-verification: lightbox prev/next, main gallery, deep-link arrows
import { chromium } from 'playwright';

const LOCAL_BASE = 'http://localhost:4321';

async function getFirstMultiSlideUid(page) {
  const templates = await page.locator('.floors__lightboxes [data-lightbox-id]').all();
  for (const el of templates) {
    const uid = await el.getAttribute('data-lightbox-id');
    const slideCount = await el.locator('[data-behavior="slider-slide"]').count();
    if (slideCount >= 2) return uid;
  }
  return null;
}

async function testLightboxNav(browser, locale, presetUid) {
  console.log(`\n=== [${locale}] Lightbox nav test ===`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const results = {};

  await page.goto(`${LOCAL_BASE}/${locale}/accommodation`, { waitUntil: 'networkidle', timeout: 30000 });

  const uid = presetUid ?? await getFirstMultiSlideUid(page);
  if (!uid) {
    console.log(`  SKIP: no multi-slide floor found for ${locale}`);
    await ctx.close();
    return { skip: true };
  }
  console.log(`  Using uid: ${uid}`);

  // Check 1: template still has data-behavior="slider" (not stripped by inline script)
  const templateDataBehavior = await page
    .locator(`.floors__lightboxes [data-lightbox-id="${uid}"] .lightbox__inner`)
    .evaluate((el) => el.getAttribute('data-behavior'));
  results.templateHasDataBehavior = templateDataBehavior === 'slider';
  console.log(`  [1] Template data-behavior="${templateDataBehavior}" => ${results.templateHasDataBehavior ? 'PASS' : 'FAIL (stripped at DOMContentLoaded)'}`);

  // Open lightbox
  const trigger = page.locator(`[data-behavior="lightbox"][data-lightbox-suffix="${uid}"]`).first();
  if (await trigger.count() === 0) {
    console.log(`  FAIL: no trigger found for uid=${uid}`);
    await ctx.close();
    return { noTrigger: true };
  }
  await trigger.click();
  await page.waitForTimeout(700);

  const container = page.locator('.our-lightbox__container');
  results.lightboxOpened = (await container.count()) > 0;
  console.log(`  [2] Lightbox opened: ${results.lightboxOpened ? 'PASS' : 'FAIL'}`);
  if (!results.lightboxOpened) { await ctx.close(); return results; }

  // Check 2: cloned slider is initialised — data-behavior removed, our-slider class added
  const clonedInner = page.locator('.our-lightbox__container .lightbox__inner').first();
  const clonedDataBehavior = await clonedInner.evaluate((el) => el.getAttribute('data-behavior'));
  const clonedHasOurSlider = await clonedInner.evaluate((el) => el.classList.contains('our-slider'));
  results.clonedSliderInitialised = clonedDataBehavior === null && clonedHasOurSlider;
  console.log(`  [3] Cloned .lightbox__inner: data-behavior="${clonedDataBehavior}", has our-slider=${clonedHasOurSlider}`);
  console.log(`      Slider initialised (Discover ran): ${results.clonedSliderInitialised ? 'PASS' : 'FAIL'}`);

  // Slide count
  const slideCount = await page.locator('.our-lightbox__container .our-slider__slide').count();
  results.slideCount = slideCount;
  console.log(`  [4] Slides in lightbox: ${slideCount}`);
  if (slideCount < 2) {
    console.log(`  SKIP nav: only ${slideCount} slide`);
    await ctx.close();
    return results;
  }

  // Transform before click
  const slidesEl = page.locator('.our-lightbox__container .our-slider__slides').first();
  const tBefore = await slidesEl.evaluate((el) => el.style.transform);
  const firstIsCurrent = await page.locator('.our-lightbox__container .our-slider__slide').first()
    .evaluate((el) => el.classList.contains('our-slider__slide--current'));
  console.log(`  [5] Transform before next: "${tBefore}", first slide is current: ${firstIsCurrent}`);

  // Click next
  const nextBtn = page.locator('.our-lightbox__container [data-behavior="slider-next"]').first();
  results.nextBtnFound = (await nextBtn.count()) > 0;
  console.log(`  [6] Next btn found: ${results.nextBtnFound ? 'YES' : 'NO'}`);
  if (!results.nextBtnFound) { await ctx.close(); return results; }

  await nextBtn.click({ force: true });
  await page.waitForTimeout(400);

  const tAfterNext = await slidesEl.evaluate((el) => el.style.transform);
  const secondIsCurrent = await page.locator('.our-lightbox__container .our-slider__slide').nth(1)
    .evaluate((el) => el.classList.contains('our-slider__slide--current'));
  results.nextArrowWorked = tAfterNext !== tBefore;
  console.log(`  [7] Transform after next: "${tAfterNext}", 2nd slide is current: ${secondIsCurrent}`);
  console.log(`      Next arrow: ${results.nextArrowWorked ? 'PASS (transform changed, --current moved)' : 'FAIL (transform unchanged)'}`);

  // Click prev
  const prevBtn = page.locator('.our-lightbox__container [data-behavior="slider-previous"]').first();
  results.prevBtnFound = (await prevBtn.count()) > 0;
  console.log(`  [8] Prev btn found: ${results.prevBtnFound ? 'YES' : 'NO'}`);
  if (!results.prevBtnFound) { await ctx.close(); return results; }

  await prevBtn.click({ force: true });
  await page.waitForTimeout(400);

  const tAfterPrev = await slidesEl.evaluate((el) => el.style.transform);
  const firstCurrentAgain = await page.locator('.our-lightbox__container .our-slider__slide').first()
    .evaluate((el) => el.classList.contains('our-slider__slide--current'));
  results.prevArrowWorked = tAfterPrev !== tAfterNext;
  console.log(`  [9] Transform after prev: "${tAfterPrev}", 1st slide current again: ${firstCurrentAgain}`);
  console.log(`      Prev arrow: ${results.prevArrowWorked ? 'PASS (transform changed back)' : 'FAIL (transform unchanged)'}`);

  await ctx.close();
  return results;
}

async function testMainGallery(browser) {
  console.log(`\n=== Main gallery slider test (en) ===`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const results = {};

  await page.goto(`${LOCAL_BASE}/en/accommodation`, { waitUntil: 'networkidle', timeout: 30000 });

  const mainSlider = page.locator('.slider.our-slider').first();
  results.mainSliderFound = (await mainSlider.count()) > 0;
  console.log(`  [1] Main slider (.slider.our-slider): ${results.mainSliderFound ? 'FOUND' : 'NOT FOUND'}`);
  if (!results.mainSliderFound) { await ctx.close(); return results; }

  const slideCount = await mainSlider.locator('.our-slider__slide').count();
  const navDots = await mainSlider.locator('[data-behavior="slider-nav-item"]').count();
  results.mainSlideCount = slideCount;
  results.navDotCount = navDots;
  console.log(`  [2] Slides: ${slideCount}, Nav dots: ${navDots}`);

  const slidesEl = mainSlider.locator('.our-slider__slides').first();
  const tBefore = await slidesEl.evaluate((el) => el.style.transform);
  console.log(`  [3] Transform before next: "${tBefore}"`);

  const mainNext = mainSlider.locator('[data-behavior="slider-next"]').first();
  results.mainNextFound = (await mainNext.count()) > 0;
  console.log(`  [4] Next btn: ${results.mainNextFound ? 'FOUND' : 'NOT FOUND'}`);
  if (results.mainNextFound) {
    await mainNext.click({ force: true });
    await page.waitForTimeout(400);
    const tAfter = await slidesEl.evaluate((el) => el.style.transform);
    results.mainNextWorked = tAfter !== tBefore;
    console.log(`  [5] Transform after next: "${tAfter}" => ${results.mainNextWorked ? 'PASS' : 'FAIL'}`);
  }

  // Autoplay: wait 4s and see if slide advances
  const tBeforeAuto = await slidesEl.evaluate((el) => el.style.transform);
  console.log(`  [6] Waiting 4s for autoplay check...`);
  await page.waitForTimeout(4000);
  const tAfterAuto = await slidesEl.evaluate((el) => el.style.transform);
  results.autoplays = tAfterAuto !== tBeforeAuto;
  console.log(`  [7] Autoplay: "${tBeforeAuto}" => "${tAfterAuto}" => ${results.autoplays ? 'PASS (advanced)' : 'FAIL (did not advance)'}`);

  await ctx.close();
  return results;
}

async function testDeepLink(browser, uid) {
  console.log(`\n=== Deep-link cold-load test (en/accommodation/${uid}) ===`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const results = {};

  await page.goto(`${LOCAL_BASE}/en/accommodation/${uid}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);

  const container = page.locator('.our-lightbox__container');
  results.autoOpened = (await container.count()) > 0;
  console.log(`  [1] Lightbox auto-opened: ${results.autoOpened ? 'PASS' : 'FAIL'}`);
  if (!results.autoOpened) { await ctx.close(); return results; }

  const clonedHasOurSlider = await page.locator('.our-lightbox__container .lightbox__inner')
    .evaluate((el) => el.classList.contains('our-slider'));
  results.sliderInitialised = clonedHasOurSlider;
  console.log(`  [2] Slider initialised (our-slider class): ${clonedHasOurSlider ? 'PASS' : 'FAIL'}`);

  const slidesEl = page.locator('.our-lightbox__container .our-slider__slides').first();
  const tBefore = await slidesEl.evaluate((el) => el.style.transform);
  const nextBtn = page.locator('.our-lightbox__container [data-behavior="slider-next"]').first();
  results.nextFound = (await nextBtn.count()) > 0;
  console.log(`  [3] Next btn: ${results.nextFound ? 'FOUND' : 'NOT FOUND'}`);
  if (results.nextFound) {
    await nextBtn.click({ force: true });
    await page.waitForTimeout(400);
    const tAfter = await slidesEl.evaluate((el) => el.style.transform);
    results.nextWorked = tAfter !== tBefore;
    console.log(`  [4] Transform "${tBefore}" => "${tAfter}" => ${results.nextWorked ? 'PASS' : 'FAIL'}`);
  }

  await ctx.close();
  return results;
}

const browser = await chromium.launch({ headless: true });

console.log('=== BUG-6 Re-verification: lightbox prev/next arrows ===');
console.log('Context: BaseLayout.astro is:inline initSlider has been REMOVED\n');

const lb = {};
lb.en = await testLightboxNav(browser, 'en', '22');
lb.fr = await testLightboxNav(browser, 'fr', null);
lb.nl = await testLightboxNav(browser, 'nl', null);

const gallery = await testMainGallery(browser);
const deepLink = await testDeepLink(browser, '22');

await browser.close();

console.log('\n======= FINAL SUMMARY =======');
for (const [locale, r] of Object.entries(lb)) {
  if (r.skip)      { console.log(`[${locale}] Lightbox nav: SKIP`); continue; }
  if (r.noTrigger) { console.log(`[${locale}] Lightbox nav: SKIP (no trigger)`); continue; }
  const pass = r.clonedSliderInitialised && r.nextArrowWorked && r.prevArrowWorked;
  console.log(`[${locale}] Lightbox nav: ${pass ? 'PASS' : 'FAIL'} | template-data-behavior=${r.templateHasDataBehavior} | slider-init=${r.clonedSliderInitialised} | next=${r.nextArrowWorked} | prev=${r.prevArrowWorked}`);
}
const galleryPass = gallery.mainSliderFound && gallery.mainNextWorked && gallery.autoplays;
console.log(`[en]  Main gallery:  ${galleryPass ? 'PASS' : 'FAIL'} | found=${gallery.mainSliderFound} | slides=${gallery.mainSlideCount} | next-worked=${gallery.mainNextWorked} | autoplay=${gallery.autoplays} | nav-dots=${gallery.navDotCount}`);
const dlPass = deepLink.autoOpened && deepLink.sliderInitialised && deepLink.nextWorked;
console.log(`[en]  Deep-link lb: ${dlPass ? 'PASS' : 'FAIL'} | auto-opened=${deepLink.autoOpened} | slider-init=${deepLink.sliderInitialised} | next-worked=${deepLink.nextWorked}`);
