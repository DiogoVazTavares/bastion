// C# enum BackgroundColor is stored as an integer index by MongoDB.Driver
const BG_COLOR_BY_INDEX = { 0: 'White', 1: 'Lightgray', 2: 'Gray', 3: 'Blue' };

/**
 * Normalize a CKEditor text value: treat empty string the same as null.
 *
 * Strapi v5 i18n bug: when different locales send inconsistent null-vs-empty-string
 * values for a localized text field inside a dynamic-zone component, Strapi resets
 * the localized repeatable-component entries of the whole block for the other locales.
 * Normalising to null everywhere prevents the mismatch.
 */
function normText(val) {
  if (val === null || val === undefined || val === '') return null;
  return val;
}

export function mapBackgroundColor(raw) {
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return BG_COLOR_BY_INDEX[raw] ?? 'White';
  return 'White';
}

export function mapParagraph(doc) {
  return {
    title:            doc.Title     ?? null,
    text:             normText(doc.Text),
    show:             doc.Show      ?? true,
    show_title:       doc.ShowTitle ?? true,
    background_color: mapBackgroundColor(doc.BackgroundColor),
  };
}

export function mapParagraphImage(doc, imageId) {
  return {
    title:            doc.Title     ?? null,
    text:             normText(doc.Text),
    image:            imageId       ?? null,
    show:             doc.Show      ?? true,
    show_title:       doc.ShowTitle ?? true,
    background_color: mapBackgroundColor(doc.BackgroundColor),
  };
}

export function mapBuilding(doc, itemImageIds) {
  const items = (doc.Items ?? []).map((item, i) => ({
    big_image:   itemImageIds?.[i]?.bigImageId   ?? null,
    small_image: itemImageIds?.[i]?.smallImageId ?? null,
    title:       item.Title ?? null,
    text:        normText(item.Text),
  }));
  return {
    show:             doc.Show      ?? true,
    show_title:       doc.ShowTitle ?? true,
    background_color: mapBackgroundColor(doc.BackgroundColor),
    items,
  };
}

export function mapPartners(doc, imageIds) {
  return {
    title:            doc.Title     ?? null,
    text:             normText(doc.Text),
    images:           imageIds      ?? [],
    show:             doc.Show      ?? true,
    show_title:       doc.ShowTitle ?? true,
    background_color: mapBackgroundColor(doc.BackgroundColor),
  };
}

/**
 * Map a PanelSlider doc into a blocks.slider payload.
 *
 * @param {object}   doc            - Legacy MongoDB PanelSlider document.
 * @param {object[]} slideImageIds  - Parallel array to doc.Slides (the ordered ISlide list).
 *                                    Each entry is either { imageId: <number|null> } for a
 *                                    SlideImage slide, or null for a SlideText slide.
 *                                    Caller pre-resolves PictureRef → Strapi media ID via
 *                                    uploadMedia (same responsibility as mapBuilding's
 *                                    itemImageIds). Must be the same length and order as
 *                                    doc.Slides.
 *
 * Identity key (for idempotency at the page level): the containing page's Strapi entry ID +
 * the dynamic-zone index of this block. Slide order is preserved exactly from doc.Slides.
 *
 * Non-localised fields: background_color, slide-image.image.
 * Localised fields:     title, show, show_title, slides (text within slide-text entries).
 *
 * The caller must pass the locale-appropriate doc (en/fr/nl MongoDB document). For the
 * non-localised slide-image.image field the en imageId is authoritative and must be copied
 * to fr/nl payloads via applyNonLocalised at the slide level — this is the same contract
 * as mapBuilding/mapPartners. Because slides is itself a localised DZ, the caller handles
 * this by passing identical slideImageIds across all three locale calls (image never changes
 * per locale) and using normText for the localised text-slide text.
 */
export function mapSlider(doc, slideImageIds = []) {
  const slides = (doc.Slides ?? []).map((slide, i) => {
    // SlideImage: _t (Mongo discriminator) is "SlideImage", or presence of Image field
    const isImage =
      slide._t === 'SlideImage' ||
      (slide.Image !== undefined && slide.Text === undefined);

    if (isImage) {
      return {
        __component: 'blocks.slide-image',
        image: slideImageIds[i]?.imageId ?? null,
      };
    }

    // SlideText
    return {
      __component: 'blocks.slide-text',
      text: normText(slide.Text),
    };
  });

  return {
    title:            doc.Title     ?? null,
    show:             doc.Show      ?? true,
    show_title:       doc.ShowTitle ?? true,
    background_color: mapBackgroundColor(doc.BackgroundColor),
    slides,
  };
}

/**
 * Returns new payloads with non-localised fields copied from the 'en' payload to all locales.
 * Does not mutate the input.
 */
export function applyNonLocalised(payloads, nonLocalisedFields) {
  if (!payloads.en) {
    throw new Error(
      'applyNonLocalised: payloads must include an "en" entry to source non-localised field values'
    );
  }
  const enValues = Object.fromEntries(
    nonLocalisedFields.map(f => [f, payloads.en[f]])
  );
  return Object.fromEntries(
    Object.entries(payloads).map(([locale, payload]) => [
      locale,
      { ...payload, ...enValues },
    ])
  );
}
