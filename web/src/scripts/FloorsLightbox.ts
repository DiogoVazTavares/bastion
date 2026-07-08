// Island lightbox: open a floor's embedded gallery on click, reuse the ported Slider
// for image navigation. No network round-trip (see docs/decisions.md 2026-06-23).
//
// Deep-link support (issue #20) mirrors the legacy HistoryManager.ChangeState behaviour:
// opening a lightbox appends "/{uid}" to the *current page URL* (e.g. /en/accommodation →
// /en/accommodation/{uid}); closing it strips the suffix back off. Browser back/forward is
// driven from the URL via popstate so the lightbox open/close stays in sync with history.
import { Discover as DiscoverSliders } from "./Slider";

// Populated in init(); needed by the popstate handler to resolve a uid → its hidden fragment.
const lightboxesByUid = new Map<string, Element>();

// The uid the URL currently points to (its last path segment), if it names a known lightbox.
function currentSuffix(): string | null {
  const segments = window.location.pathname.replace(/\/$/, "").split("/");
  const last = segments[segments.length - 1];
  return last && lightboxesByUid.has(last) ? last : null;
}

function closeLightbox(updateHistory = true) {
  const container = document.querySelector(".our-lightbox__container");
  const bg = document.querySelector(".our-lightbox__bg");
  if (container) container.remove();
  if (bg) bg.remove();
  document.body.classList.remove("our-lightbox", "our-lightbox--shown");

  // Strip the trailing "/{uid}" back off the URL (mirrors legacy HistoryManager close).
  if (updateHistory && currentSuffix()) {
    const stripped = window.location.pathname.replace(/\/[^/]+\/?$/, "");
    history.pushState(
      {},
      "",
      stripped + window.location.search + window.location.hash,
    );
  }
}

function openLightbox(source: Element, updateHistory = true) {
  // Avoid stacking multiple open lightboxes.
  if (document.querySelector(".our-lightbox__container")) return;

  const fragment = source.querySelector(".lightbox");
  if (!fragment) return;

  const container = document.createElement("div");
  container.className = "our-lightbox__container";
  container.appendChild(fragment.cloneNode(true));

  const bg = document.createElement("div");
  bg.className = "our-lightbox__bg";
  bg.addEventListener("click", () => closeLightbox());

  document.body.appendChild(container);
  document.body.appendChild(bg);
  document.body.classList.add("our-lightbox");

  // Force reflow so the show transition runs (mirrors legacy Lightbox.ts).
  void (container as HTMLElement).offsetWidth;
  container.classList.add("show");
  bg.classList.add("show");
  document.body.classList.add("our-lightbox--shown");

  container
    .querySelectorAll("[data-behavior='lightbox-close']")
    .forEach((el) => el.addEventListener("click", () => closeLightbox()));

  // Initialise the cloned slider (Discover only picks up un-initialised sliders).
  DiscoverSliders();

  // Append "/{uid}" to the current page URL for shareability, unless it is already there
  // (cold-load deep link) — mirrors legacy HistoryManager.ChangeState (line 190 of Lightbox.ts).
  const suffix = source.getAttribute("data-lightbox-id");
  if (updateHistory && suffix && currentSuffix() !== suffix) {
    const base = window.location.pathname.replace(/\/$/, "");
    history.pushState(
      { lightboxUid: suffix },
      "",
      `${base}/${suffix}${window.location.search}${window.location.hash}`,
    );
  }
}

function init() {
  document
    .querySelectorAll(".floors__lightboxes [data-lightbox-id]")
    .forEach((el) => {
      const uid = el.getAttribute("data-lightbox-id");
      if (uid) lightboxesByUid.set(uid, el);
    });

  document
    .querySelectorAll("[data-behavior='lightbox'][data-lightbox-suffix]")
    .forEach((trigger) => {
      const uid = trigger.getAttribute("data-lightbox-suffix");
      if (!uid || !lightboxesByUid.has(uid)) return;
      trigger.addEventListener("click", (e) => {
        e.preventDefault();
        openLightbox(lightboxesByUid.get(uid)!);
      });
    });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });

  // Browser back/forward: open/close the lightbox to match whatever the URL now points to,
  // without pushing further history entries.
  window.addEventListener("popstate", () => {
    const suffix = currentSuffix();
    const isOpen = !!document.querySelector(".our-lightbox__container");
    if (suffix && !isOpen) {
      openLightbox(lightboxesByUid.get(suffix)!, false);
    } else if (!suffix && isOpen) {
      closeLightbox(false);
    }
  });

  // Auto-open on cold load if the page was reached via a uid deep-link. The URL already
  // carries the suffix, so do not push another history entry.
  const floorsEl = document.querySelector("[data-behavior='floors']");
  const autoUid = floorsEl?.getAttribute("data-autoopen-uid");
  if (autoUid && lightboxesByUid.has(autoUid)) {
    openLightbox(lightboxesByUid.get(autoUid)!, false);
  }
}

init();
