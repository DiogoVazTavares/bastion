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
 * Map a PanelFloors doc into a blocks.floors payload.
 *
 * @param {object}     doc           - Legacy MongoDB PanelFloors document.
 * @param {number[][]} floorImageIds - Parallel array to doc.Floors. Each inner array holds
 *                                    the Strapi media IDs (numbers) for that floor's images.
 *                                    Same upload-then-id pattern as mapBuilding's itemImageIds,
 *                                    one level deeper (per-floor array rather than flat).
 *
 * Identity key: containing page Strapi entry ID + DZ index of this block.
 *
 * Non-localised fields: background_color, floors[].orientation, floors[].uid, floors[].images.
 *   Caller copies these from the 'en' payload to fr/nl via applyNonLocalised at the floor-item
 *   level — same contract as mapBuilding.
 * Localised fields: title, intro_title, caption, show, show_title, floors[].number,
 *   floors[].text, floors[].description.
 */
export function mapFloors(doc, floorImageIds = []) {
  const ORIENTATION_BY_INDEX = { 0: 'Left', 1: 'Right', 2: 'Full' };
  const floors = (doc.Floors ?? []).map((floor, i) => ({
    number:      floor.Number ?? null,
    orientation: typeof floor.Orientation === 'string'
                   ? floor.Orientation
                   : (ORIENTATION_BY_INDEX[floor.Orientation] ?? 'Left'),
    text:        floor.Text ?? null,
    description: floor.Description ?? null,
    uid:         floor.UID ?? null,
    images:      floorImageIds[i] ?? [],
  }));
  return {
    title:            doc.Title ?? null,
    intro_title:      normText(doc.IntroTitle),
    caption:          doc.Caption ?? null,
    show:             doc.Show ?? true,
    show_title:       doc.ShowTitle ?? true,
    background_color: mapBackgroundColor(doc.BackgroundColor),
    floors,
  };
}

/**
 * Map a PanelInfo doc into a blocks.info payload.
 *
 * @param {object}   doc           - Legacy MongoDB PanelInfo document.
 * @param {object[]} itemImageIds  - Parallel array to doc.Items (the ordered PanelInfoItem list).
 *                                   Each entry is { imageId: <number|null> } where imageId is the
 *                                   Strapi media library ID for the item's PictureRef Image.
 *                                   Caller pre-resolves PictureRef → Strapi media ID via
 *                                   uploadMedia (same responsibility as mapBuilding's
 *                                   itemImageIds). Must be the same length and order as
 *                                   doc.Items. Pass [] or omit when there are no items.
 *
 * Identity key (for idempotency at the page level): the containing page's Strapi entry ID +
 * the dynamic-zone index of this block. Item order is preserved exactly from doc.Items.
 *
 * Non-localised fields: background_color, items[].image.
 * Localised fields:     title, show, show_title, items[].text.
 *
 * The caller must pass the locale-appropriate doc (en/fr/nl MongoDB document). For the
 * non-localised items[].image field the en imageId is authoritative and must be copied to
 * fr/nl payloads via applyNonLocalised at the block level — same contract as mapBuilding.
 * The caller must upload each PanelInfoItem.Image to the Strapi media library before calling
 * this function and pass the resulting media IDs in itemImageIds.
 */
export function mapInfo(doc, itemImageIds = []) {
  const items = (doc.Items ?? []).map((item, i) => ({
    image: itemImageIds?.[i]?.imageId ?? null,
    text:  normText(item.Text),
  }));
  return {
    title:            doc.Title     ?? null,
    show:             doc.Show      ?? true,
    // C# bool defaults to false; MongoDB.Driver omits fields serialised at their default value.
    // A missing ShowTitle therefore means false, not true. Verified against Accommodation Mongo
    // data: the first PanelInfo (spec details) has no ShowTitle field and the live site hides its
    // title. All panels where ShowTitle is legitimately true store it explicitly as boolean true.
    show_title:       doc.ShowTitle ?? false,
    background_color: mapBackgroundColor(doc.BackgroundColor),
    items,
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
