// C# enum BackgroundColor is stored as an integer index by MongoDB.Driver
const BG_COLOR_BY_INDEX = { 0: 'White', 1: 'Lightgray', 2: 'Gray', 3: 'Blue' };

export function mapBackgroundColor(raw) {
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return BG_COLOR_BY_INDEX[raw] ?? 'White';
  return 'White';
}

export function mapParagraph(doc) {
  return {
    title:            doc.Title     ?? null,
    text:             doc.Text      ?? null,
    show:             doc.Show      ?? true,
    show_title:       doc.ShowTitle ?? true,
    background_color: mapBackgroundColor(doc.BackgroundColor),
  };
}

export function mapParagraphImage(doc, imageId) {
  return {
    title:            doc.Title     ?? null,
    text:             doc.Text      ?? null,
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
    text:        item.Text  ?? null,
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
    text:             doc.Text      ?? null,
    images:           imageIds      ?? [],
    show:             doc.Show      ?? true,
    show_title:       doc.ShowTitle ?? true,
    background_color: mapBackgroundColor(doc.BackgroundColor),
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
