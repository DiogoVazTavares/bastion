export interface TermsData {
  title: string | null;
  text: string | null;
  show: boolean;
  show_title: boolean;
  background_color: 'White' | 'Lightgray' | 'Gray' | 'Green';
  footer_title: string | null;
  browser_title: string | null;
  google_description: string | null;
}

export async function fetchTerms(locale: string): Promise<TermsData> {
  const base = import.meta.env.STRAPI_URL;
  const token = import.meta.env.STRAPI_TOKEN;

  if (!base) throw new Error('STRAPI_URL is not set');

  const url = new URL('/api/terms', base);
  url.searchParams.set('locale', locale);

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) {
    throw new Error(`Failed to fetch Terms [${locale}]: ${res.status} ${res.statusText}`);
  }

  const { data } = await res.json();
  return data as TermsData;
}

export interface CreditsData {
  title: string | null;
  text: string | null;
  show: boolean;
  show_title: boolean;
  background_color: 'White' | 'Lightgray' | 'Gray' | 'Green';
  footer_title: string | null;
  browser_title: string | null;
  google_description: string | null;
}

export async function fetchCredits(locale: string): Promise<CreditsData> {
  const base = import.meta.env.STRAPI_URL;
  const token = import.meta.env.STRAPI_TOKEN;

  if (!base) throw new Error('STRAPI_URL is not set');

  const url = new URL('/api/credits', base);
  url.searchParams.set('locale', locale);

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) {
    throw new Error(`Failed to fetch Credits [${locale}]: ${res.status} ${res.statusText}`);
  }

  const { data } = await res.json();
  return data as CreditsData;
}

export interface ContactData {
  title: string | null;
  text: string | null;
}

export async function fetchContact(locale: string): Promise<ContactData> {
  const base = import.meta.env.STRAPI_URL;
  const token = import.meta.env.STRAPI_TOKEN;

  if (!base) throw new Error('STRAPI_URL is not set');

  const url = new URL('/api/contact', base);
  url.searchParams.set('locale', locale);

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) {
    throw new Error(`Failed to fetch Contact [${locale}]: ${res.status} ${res.statusText}`);
  }

  const { data } = await res.json();
  return data as ContactData;
}
