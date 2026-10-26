/** Locale choice for the public site (/, /get-started, /docs, /marks). /demo has its own. */
export const siteLocales = ["en", "ja", "zh-Hans", "zh-Hant", "ko"] as const;
export type SiteLocale = (typeof siteLocales)[number];
export const defaultLocale: SiteLocale = "en";
export const storageKey = "proofmarks.site.lang";

/** Each option is shown in its own language. */
export const localeNames: Record<SiteLocale, string> = {
  en: "English",
  ja: "日本語",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
  ko: "한국어",
};

export function isSiteLocale(value: unknown): value is SiteLocale {
  return typeof value === "string" && (siteLocales as readonly string[]).includes(value);
}

/** Maps a BCP 47 tag to a site locale: zh-TW/HK/MO/Hant → zh-Hant, other zh → zh-Hans. */
export function matchLocale(tag: string): SiteLocale | null {
  const parts = tag.trim().toLowerCase().replace(/_/g, "-").split("-");
  const language = parts[0];
  if (language === "en") return "en";
  if (language === "ja") return "ja";
  if (language === "ko") return "ko";
  if (language === "zh") {
    // An explicit script subtag wins over the region (zh-Hans-TW is Simplified).
    if (parts.includes("hans")) return "zh-Hans";
    if (parts.includes("hant") || parts.some((part) => part === "tw" || part === "hk" || part === "mo")) return "zh-Hant";
    return "zh-Hans";
  }
  return null;
}

export function localeFromLanguages(languages: readonly string[]): SiteLocale {
  for (const tag of languages) {
    const match = matchLocale(tag);
    if (match) return match;
  }
  return defaultLocale;
}

/** Accepts exact ids and common aliases in ?lang= (e.g. zh-TW, zh-CN, ja-JP). */
export function localeFromQuery(search: string): SiteLocale | null {
  const value = new URLSearchParams(search).get("lang");
  if (!value) return null;
  return isSiteLocale(value) ? value : matchLocale(value);
}

export function navigatorLocale(): SiteLocale {
  if (typeof navigator === "undefined") return defaultLocale;
  return localeFromLanguages(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

export function readStoredLocale(): SiteLocale | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    return isSiteLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeLocale(locale: SiteLocale): void {
  try {
    window.localStorage.setItem(storageKey, locale);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); ?lang= still works.
  }
}

/** ?lang= wins, then a stored choice, then the browser languages, then English. */
export function initialLocale(search: string): { locale: SiteLocale; fromQuery: boolean } {
  const fromQuery = localeFromQuery(search);
  if (fromQuery) return { locale: fromQuery, fromQuery: true };
  return { locale: readStoredLocale() ?? navigatorLocale(), fromQuery: false };
}

/**
 * An internal link that keeps the current language. The parameter is left out
 * when a visitor without stored preferences would get this language anyway.
 */
export function localizedHref(href: string, locale: SiteLocale): string {
  if (!href.startsWith("/") || href.startsWith("//") || /\.txt(?:$|[?#])/.test(href) || href.startsWith("/demo")) return href;
  if (locale === navigatorLocale()) return href;
  const hashIndex = href.indexOf("#");
  const path = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const [pathname, query = ""] = path.split("?") as [string, string?];
  const params = new URLSearchParams(query);
  params.set("lang", locale);
  return `${pathname}?${params.toString()}${hash}`;
}
