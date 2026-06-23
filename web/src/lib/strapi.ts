export interface TermsData {
  title: string | null;
  text: string | null;
  show: boolean;
  show_title: boolean;
  background_color: "White" | "Lightgray" | "Gray" | "Blue";
  footer_title: string | null;
  browser_title: string | null;
  google_description: string | null;
}

export async function fetchTerms(locale: string): Promise<TermsData> {
  const base = import.meta.env.STRAPI_URL;
  const token = import.meta.env.STRAPI_TOKEN;

  if (!base) throw new Error("STRAPI_URL is not set");

  const url = new URL("/api/terms", base);
  url.searchParams.set("locale", locale);

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch Terms [${locale}]: ${res.status} ${res.statusText}`,
    );
  }

  const { data } = await res.json();
  return data as TermsData;
}

export interface CreditsData {
  title: string | null;
  text: string | null;
  show: boolean;
  show_title: boolean;
  background_color: "White" | "Lightgray" | "Gray" | "Blue";
  footer_title: string | null;
  browser_title: string | null;
  google_description: string | null;
}

export async function fetchCredits(locale: string): Promise<CreditsData> {
  const base = import.meta.env.STRAPI_URL;
  const token = import.meta.env.STRAPI_TOKEN;

  if (!base) throw new Error("STRAPI_URL is not set");

  const url = new URL("/api/credits", base);
  url.searchParams.set("locale", locale);

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch Credits [${locale}]: ${res.status} ${res.statusText}`,
    );
  }

  const { data } = await res.json();
  return data as CreditsData;
}

export type BgColor = "White" | "Lightgray" | "Gray" | "Blue";

export interface MediaRef {
  url: string;
  alternativeText: string | null;
}

export interface BuildingItemData {
  big_image: MediaRef | null;
  small_image: MediaRef | null;
  title: string | null;
  text: string | null;
}

export interface FloorItemData {
  number: string | null;
  orientation: "Left" | "Right" | "Full";
  text: string | null;
  description: string | null;
  uid: string | null;
  images: MediaRef[];
}

export type BuildingBlock =
  | {
      __component: "blocks.paragraph";
      show: boolean;
      show_title: boolean;
      background_color: BgColor;
      title: string | null;
      text: string | null;
    }
  | {
      __component: "blocks.paragraph-image";
      show: boolean;
      show_title: boolean;
      background_color: BgColor;
      title: string | null;
      text: string | null;
      image: MediaRef | null;
    }
  | {
      __component: "blocks.building";
      show: boolean;
      show_title: boolean;
      background_color: BgColor;
      items: BuildingItemData[];
    }
  | {
      __component: "blocks.partners";
      show: boolean;
      show_title: boolean;
      background_color: BgColor;
      title: string | null;
      text: string | null;
      images: MediaRef[];
    };

// blocks.floors is Accommodation-only (PanelFloors lives under Accommodation, not Building).
// FloorItemData + FloorsBlock are consumed by the Accommodation fetch (issue #20).
export interface FloorsBlock {
  __component: "blocks.floors";
  show: boolean;
  show_title: boolean;
  background_color: BgColor;
  title: string | null;
  intro_title: string | null;
  caption: string | null;
  floors: FloorItemData[];
}

export interface BuildingData {
  title: string | null;
  hero: string | null;
  image: MediaRef | null;
  browser_title: string | null;
  google_description: string | null;
  footer_title: string | null;
  blocks: BuildingBlock[];
}

export async function fetchBuilding(locale: string): Promise<BuildingData> {
  const base = import.meta.env.STRAPI_URL;
  const token = import.meta.env.STRAPI_TOKEN;

  if (!base) throw new Error("STRAPI_URL is not set");

  const url = new URL("/api/building", base);
  url.searchParams.set("locale", locale);
  // Strapi v5 has no `populate=deep`; populate each dynamic-zone component's media explicitly via `on`.
  const populate: Record<string, string> = {
    "populate[image]": "true",
    "populate[blocks][on][blocks.paragraph][populate]": "*",
    "populate[blocks][on][blocks.paragraph-image][populate][image]": "true",
    "populate[blocks][on][blocks.building][populate][items][populate][big_image]":
      "true",
    "populate[blocks][on][blocks.building][populate][items][populate][small_image]":
      "true",
    "populate[blocks][on][blocks.partners][populate][images]": "true",
  };
  for (const [k, v] of Object.entries(populate)) url.searchParams.set(k, v);

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch Building [${locale}]: ${res.status} ${res.statusText}`,
    );
  }

  const { data } = await res.json();
  return data as BuildingData;
}

export interface ContactData {
  title: string | null;
  text: string | null;
}

export async function fetchContact(locale: string): Promise<ContactData> {
  const base = import.meta.env.STRAPI_URL;
  const token = import.meta.env.STRAPI_TOKEN;

  if (!base) throw new Error("STRAPI_URL is not set");

  const url = new URL("/api/contact", base);
  url.searchParams.set("locale", locale);

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch Contact [${locale}]: ${res.status} ${res.statusText}`,
    );
  }

  const { data } = await res.json();
  return data as ContactData;
}

// Accommodation types
export interface SlideImageData {
  __component: "blocks.slide-image";
  image: (MediaRef & { caption: string | null }) | null;
}

export interface SlideTextData {
  __component: "blocks.slide-text";
  text: string | null;
}

export interface InfoItemData {
  image: MediaRef | null;
  text: string | null;
}

export type AccommodationBlock =
  | { __component: "blocks.paragraph"; show: boolean; show_title: boolean; background_color: BgColor; title: string | null; text: string | null }
  | { __component: "blocks.slider"; show: boolean; show_title: boolean; background_color: BgColor; title: string | null; slides: (SlideImageData | SlideTextData)[] }
  | { __component: "blocks.info"; show: boolean; show_title: boolean; background_color: BgColor; title: string | null; items: InfoItemData[] }
  | { __component: "blocks.floors"; show: boolean; show_title: boolean; background_color: BgColor; title: string | null; intro_title: string | null; caption: string | null; floors: FloorItemData[] };

export interface AccommodationData {
  title: string | null;
  hero: string | null;
  image: MediaRef | null;
  browser_title: string | null;
  google_description: string | null;
  footer_title: string | null;
  blocks: AccommodationBlock[];
}

export async function fetchAccommodation(locale: string): Promise<AccommodationData> {
  const base = import.meta.env.STRAPI_URL;
  const token = import.meta.env.STRAPI_TOKEN;

  if (!base) throw new Error("STRAPI_URL is not set");

  const url = new URL("/api/accommodation", base);
  url.searchParams.set("locale", locale);
  const populate: Record<string, string> = {
    "populate[image]": "true",
    "populate[blocks][on][blocks.paragraph][populate]": "*",
    "populate[blocks][on][blocks.slider][populate][slides][on][blocks.slide-image][populate][image]": "true",
    "populate[blocks][on][blocks.slider][populate][slides][on][blocks.slide-text][populate]": "*",
    "populate[blocks][on][blocks.info][populate][items][populate][image]": "true",
    "populate[blocks][on][blocks.floors][populate][floors][populate][images]": "true",
  };
  for (const [k, v] of Object.entries(populate)) url.searchParams.set(k, v);

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch Accommodation [${locale}]: ${res.status} ${res.statusText}`,
    );
  }

  const { data } = await res.json();
  return data as AccommodationData;
}
