/**
 * Slider.ts — port of old/Scripts/Slider.ts
 *
 * Changes from the original:
 *   - `import Hammer from 'hammerjs'` replaces the CDN script tag
 *   - `Modernizr.prefixed()` removed; `transform` is baseline — ApplyTransform
 *     always uses translate3d
 *   - `import Events` / `Events.Publish` removed (no old event bus)
 *   - `observeDOM` / MutationObserver re-scan removed; Astro handles lifecycle
 *   - `Discover` is exported as a named export
 */
import Hammer from "hammerjs";

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

const ApplyTransform = (elt: HTMLElement, tx: string, ty: string) => {
  elt.style.transform = `translate3d(${tx},${ty},0)`;
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ISliderOptions {
  x: (slider: Slider, slide: Element, index: number) => string;
  y: (slider: Slider, slide: Element, index: number) => string;
  threshold: (slider: Slider, ev: HammerInput) => number;
  dragx: (slider: Slider, ev: HammerInput) => string;
  current: number;
  loop: boolean;
  stopOnInteract: boolean;
  autoplay: boolean;
  delay: number;
  slidesPerPage: (slider: Slider) => number;
}

const ScalarDistance = (ev: HammerInput): number => {
  switch (ev.direction) {
    case Hammer.DIRECTION_RIGHT:
      return -ev.distance;
    case Hammer.DIRECTION_LEFT:
      return ev.distance;
    default:
      return ev.distance;
  }
};

// ---------------------------------------------------------------------------
// SliderOptions
// ---------------------------------------------------------------------------

export class SliderOptions implements ISliderOptions {
  x(slider: Slider, _slide: Element, index: number): string {
    const spp = slider.Options.slidesPerPage(slider);
    return `${(-index * 100) / spp}%`;
  }

  y(_slider: Slider, _slide: Element, _index: number): string {
    return "0";
  }

  dragx(slider: Slider, ev: HammerInput): string {
    const distance = ScalarDistance(ev);
    const spp = slider.Options.slidesPerPage(slider);
    const percent =
      (distance / (slider.Container as HTMLElement).clientWidth) * spp;
    return `${(-(percent + slider.Current) * 100) / spp}%`;
  }

  threshold(slider: Slider, ev: HammerInput): number {
    const distance = ScalarDistance(ev);
    if (!distance) return 0;
    const direction = distance / Math.abs(distance);
    const percent = distance / (slider.Container as HTMLElement).clientWidth;
    const spp = slider.Options.slidesPerPage(slider);
    if (percent * direction > 0.3 / spp) return direction;
    if (ev.velocity > 0.4) return direction;
    return 0;
  }

  current = 0;
  loop = true;
  autoplay = true;
  delay = 6000;
  stopOnInteract = true;

  slidesPerPage(slider: Slider): number {
    const slide = slider.SlideAt(slider.Current) as HTMLElement | undefined;
    if (!slide) return 1;
    const basis = parseFloat(
      window.getComputedStyle(slide).flexBasis.replace(/%/gi, ""),
    );
    return Math.max(Math.floor(100 / basis), 1);
  }
}

// ---------------------------------------------------------------------------
// Slider
// ---------------------------------------------------------------------------

export class Slider {
  public Container: Element;
  public Slides: HTMLElement;
  public Options: ISliderOptions;
  public Current: number = 0;

  private _Playing: ReturnType<typeof setInterval> | null = null;
  private _OnShow: ((slider: Slider, slide: Element, index: number) => void)[] =
    [];
  private _OnHide: ((slider: Slider, slide: Element, index: number) => void)[] =
    [];

  public OnShow(
    handler: (slider: Slider, slide: Element, index: number) => void,
  ) {
    this._OnShow.push(handler);
    return this;
  }

  public OnHide(
    handler: (slider: Slider, slide: Element, index: number) => void,
  ) {
    this._OnHide.push(handler);
    return this;
  }

  private _Slides: Element[] = [];
  private _Hammer!: HammerManager;

  _Init() {
    this.Container.classList.add("our-slider");
    this.Slides.classList.add("our-slider__slides");
    // transitionend: no event bus, nothing to publish
    this._Slides.forEach((slide) => {
      slide.classList.add("our-slider__slide");
    });

    this._Hammer = new Hammer(this.Container as HTMLElement);
    this._Hammer.get("pan").set({ direction: Hammer.DIRECTION_HORIZONTAL });
    this._Hammer.on("panstart", this._OnDragStart.bind(this));
    this._Hammer.on("panmove", this._OnDrag.bind(this));
    this._Hammer.on("panend", this._OnDragEnd.bind(this));
  }

  constructor(container: Element, options: ISliderOptions | null = null) {
    this.Options = options ?? new SliderOptions();
    this.Container = container;
    if (this.Container.getAttribute("data-behavior") === "slider") {
      this.Container.removeAttribute("data-behavior");
    }

    this.Slides = container.querySelector<HTMLElement>(
      "*[data-behavior='slider-slides']",
    )!;
    this._Slides = Array.from(
      this.Slides.querySelectorAll<Element>("*[data-behavior='slider-slide']"),
    );
    if (this._Slides.length === 0) return;

    this._Init();
    this._Go(this.Options.current);
    if (this.Options.autoplay) this.Play();
  }

  _Loop(index: number, loop: boolean | null = null): number {
    const useLoop = loop === null ? this.Options.loop : loop;
    if (useLoop) {
      index = (index + this._Slides.length) % this._Slides.length;
      if (this._Slides.length - index < this.Options.slidesPerPage(this))
        index = 0;
    } else {
      index = Math.min(Math.max(index, 0), this._Slides.length - 1);
    }
    return index;
  }

  public Go(index: number, loop: boolean | null = null): void {
    index = this._Loop(index, loop);
    this._ResetAutoPlay();
    this._Go(index);
  }

  private _SetClasses(index: number) {
    this._Slides.forEach((slide, l) => {
      if (l === index) {
        slide.classList.add("our-slider__slide--current");
        slide.classList.remove("our-slider__slide--next");
        slide.classList.remove("our-slider__slide--previous");
      } else if (l > index) {
        slide.classList.add("our-slider__slide--next");
        slide.classList.remove("our-slider__slide--current");
        slide.classList.remove("our-slider__slide--previous");
      } else {
        slide.classList.add("our-slider__slide--previous");
        slide.classList.remove("our-slider__slide--current");
        slide.classList.remove("our-slider__slide--next");
      }
    });
  }

  private _Go(index: number) {
    const slide = this._Slides[index];
    this._SetClasses(index);

    const x = this.Options.x(this, slide, index);
    const y = this.Options.y(this, slide, index);
    ApplyTransform(this.Slides, x, y);

    this._OnHide.forEach((h) => h(this, slide, this.Current));
    this.Current = index;

    this.Container.classList.toggle(
      "our-slider--first-slide",
      this.Current === 0,
    );
    this.Container.classList.toggle(
      "our-slider--last-slide",
      this.Current === this._Slides.length - 1,
    );

    this._OnShow.forEach((h) => h(this, slide, index));
  }

  private _Drag = { initX: 0, initSlider: 0, sliderX: 0 };

  private _OnDragStart(ev: HammerInput) {
    this.Slides.classList.add("our-slider__slides--dragging");
    this._OnDrag(ev);
  }

  private _OnDrag(ev: HammerInput) {
    const x = this.Options.dragx(this, ev);
    const y = this.Options.y(this, this._Slides[this.Current], this.Current);
    ApplyTransform(this.Slides, x, y);
  }

  private _OnDragEnd(ev: HammerInput) {
    this._OnDrag(ev);
    this.Slides.classList.remove("our-slider__slides--dragging");
    const diff = this.Options.threshold(this, ev);
    this.Go(this.Current + Math.ceil(diff), false);
  }

  Destroy() {
    if (this._Playing) clearInterval(this._Playing);
  }

  Play() {
    if (this.Options.delay < 0) return;
    if (this._Playing) return;
    this._Playing = setInterval(this._Next.bind(this), this.Options.delay);
  }

  _ResetAutoPlay() {
    if (!this._Playing) return;
    clearInterval(this._Playing);
    this._Playing = this.Options.stopOnInteract
      ? null
      : setInterval(this._Next.bind(this), this.Options.delay);
  }

  Pause() {
    if (!this._Playing) return;
    clearInterval(this._Playing);
    this._Playing = null;
  }

  private _Next(): boolean {
    const index = this._Loop(this.Current + 1);
    if (index === this.Current) return false;
    this._Go(index);
    return true;
  }

  Next() {
    this._ResetAutoPlay();
    return this._Next();
  }

  private _Previous(): boolean {
    const index = this._Loop(this.Current - 1);
    if (index === this.Current) return false;
    this._Go(index);
    return true;
  }

  Previous() {
    this._ResetAutoPlay();
    return this._Previous();
  }

  SlideAt(index: number): Element {
    return this._Slides[index];
  }
}

// ---------------------------------------------------------------------------
// Discover — exported for Astro <script> import
// ---------------------------------------------------------------------------

export function Discover() {
  const sliders = Array.from(
    document.querySelectorAll<Element>("*[data-behavior='slider']"),
  );

  sliders.forEach((sliderContainer) => {
    const options = new SliderOptions();

    if (sliderContainer.hasAttribute("data-slider-loop")) {
      const val = sliderContainer.getAttribute("data-slider-loop");
      options.loop = val === "true" || val === "";
    }
    options.delay = sliderContainer.hasAttribute("data-slider-delay")
      ? parseInt(sliderContainer.getAttribute("data-slider-delay")!, 10)
      : options.delay;

    if (sliderContainer.hasAttribute("data-slider-autoplay")) {
      const val = sliderContainer.getAttribute("data-slider-autoplay");
      options.autoplay = val === "true" || val === "";
    }
    if (sliderContainer.hasAttribute("data-slider-stop-on-interact")) {
      const val = sliderContainer.getAttribute("data-slider-stop-on-interact");
      options.stopOnInteract = val === "true" || val === "";
    }
    if (sliderContainer.hasAttribute("data-slider-slide-per-page")) {
      const fixed = parseInt(
        sliderContainer.getAttribute("data-slider-slide-per-page")!,
        10,
      );
      options.slidesPerPage = () => fixed;
    }

    const slider = new Slider(sliderContainer, options);

    Array.from(
      sliderContainer.querySelectorAll<Element>(
        "*[data-behavior='slider-next']",
      ),
    ).forEach((el) => el.addEventListener("click", () => slider.Next()));

    Array.from(
      sliderContainer.querySelectorAll<Element>("*[data-behavior='slider-go']"),
    ).forEach((el) => {
      const ind = parseInt(el.getAttribute("data-index")!, 10);
      el.addEventListener("click", () => slider.Go(ind));
    });

    Array.from(
      sliderContainer.querySelectorAll<Element>(
        "*[data-behavior='slider-previous']",
      ),
    ).forEach((el) => el.addEventListener("click", () => slider.Previous()));

    Array.from(
      sliderContainer.querySelectorAll<HTMLElement>(
        "*[data-behavior='slider-nav-item']",
      ),
    ).forEach((navLink) => {
      const index = parseInt(navLink.getAttribute("data-index")!, 10);
      navLink.addEventListener("click", () => slider.Go(index));
      navLink.classList.toggle(
        "our-slider__nav-item--current",
        index === slider.Current,
      );
      slider.OnShow((_s, _elt, i) => {
        navLink.classList.toggle("our-slider__nav-item--current", index === i);
      });
    });
  });
}
