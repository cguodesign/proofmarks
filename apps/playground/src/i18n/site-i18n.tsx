import { Fragment, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { en, type SiteDictionary } from "./en";
import { siteHref } from "../site-path";
import { defaultLocale, initialLocale, localeFromQuery, localizedHref, storeLocale, type SiteLocale } from "./locale";

export type { SiteDictionary } from "./en";
export { localeNames, siteLocales, type SiteLocale } from "./locale";

// English ships with the page; other languages load on demand.
const loaders: Record<Exclude<SiteLocale, "en">, () => Promise<SiteDictionary>> = {
  ja: () => import("./ja").then((module) => module.ja),
  "zh-Hans": () => import("./zh-hans").then((module) => module.zhHans),
  "zh-Hant": () => import("./zh-hant").then((module) => module.zhHant),
  ko: () => import("./ko").then((module) => module.ko),
};

type SiteText = { locale: SiteLocale; t: SiteDictionary; localized: boolean };
let state: SiteText = { locale: defaultLocale, t: en, localized: false };
const listeners = new Set<() => void>();
const cache = new Map<SiteLocale, SiteDictionary>([["en", en]]);
// Only the newest language request may apply; a slower earlier load is dropped.
let latestRequest = 0;

async function dictionaryFor(locale: SiteLocale): Promise<SiteDictionary> {
  const cached = cache.get(locale);
  if (cached) return cached;
  const dictionary = await loaders[locale as Exclude<SiteLocale, "en">]();
  cache.set(locale, dictionary);
  return dictionary;
}

function apply(locale: SiteLocale, t: SiteDictionary): void {
  state = { locale, t, localized: true };
  document.documentElement.lang = locale;
  const skip = document.querySelector<HTMLAnchorElement>(".skip-link");
  if (skip) skip.textContent = t.common.skipLink;
  for (const listener of listeners) listener();
}

/** Resolves the page language before the first render, so no English flashes first. */
export async function initSiteI18n(): Promise<void> {
  const request = ++latestRequest;
  const { locale, fromQuery } = initialLocale(window.location.search);
  if (fromQuery) storeLocale(locale);
  let t: SiteDictionary;
  try {
    t = await dictionaryFor(locale);
  } catch {
    if (request === latestRequest) apply(defaultLocale, en);
    return;
  }
  if (request === latestRequest) apply(locale, t);
}

/** Switches language in place, records it in ?lang= and remembers it. */
export async function setSiteLocale(locale: SiteLocale): Promise<void> {
  const request = ++latestRequest;
  const t = await dictionaryFor(locale);
  if (request !== latestRequest) return;
  storeLocale(locale);
  const url = new URL(window.location.href);
  url.searchParams.set("lang", locale);
  history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  apply(locale, t);
}

// Keep the language in sync when history navigation changes ?lang=.
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    const locale = localeFromQuery(window.location.search);
    if (state.localized && locale && locale !== state.locale) void setSiteLocale(locale);
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSiteText(): SiteText & { href(path: string): string } {
  const current = useSyncExternalStore(subscribe, () => state, () => state);
  return { ...current, href: (path: string) => siteHref(current.localized ? localizedHref(path, current.locale) : path) };
}

/** Fills {placeholders} in a plain string. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

const richPattern = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|\{(\w+)\}|\n/g;

/** Tokens a rich string must keep identical in every language. */
export function richInvariants(text: string): string[] {
  const tokens: string[] = [];
  for (const match of text.matchAll(richPattern)) {
    if (match[1] !== undefined) tokens.push(`code:${match[1]}`);
    else if (match[4] !== undefined) {
      tokens.push(`link:${match[4]}`);
      for (const inner of match[3]!.matchAll(/`([^`]+)`/g)) tokens.push(`code:${inner[1]}`);
    } else if (match[5] !== undefined) tokens.push(`value:${match[5]}`);
  }
  return tokens.sort();
}

function renderRich(text: string, values: Record<string, ReactNode>, href: (path: string) => string, key = ""): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  for (const match of text.matchAll(richPattern)) {
    const at = match.index ?? 0;
    if (at > cursor) nodes.push(text.slice(cursor, at));
    const id = `${key}${index++}`;
    if (match[1] !== undefined) {
      const code = match[1].replace(/\{(\w+)\}/g, (token, name: string) => {
        const value = values[name];
        return typeof value === "string" || typeof value === "number" ? String(value) : token;
      });
      nodes.push(<code key={id}>{code}</code>);
    }
    else if (match[2] !== undefined) nodes.push(<strong key={id}>{match[2]}</strong>);
    else if (match[3] !== undefined && match[4] !== undefined) {
      nodes.push(<a key={id} href={href(match[4])}>{renderRich(match[3], values, href, `${id}-`)}</a>);
    } else if (match[5] !== undefined) nodes.push(<Fragment key={id}>{values[match[5]] ?? match[0]}</Fragment>);
    else nodes.push(<br key={id} />);
    cursor = at + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

/** Renders a dictionary string with `code`, **strong**, [links](/path), {values} and line breaks. */
export function Rich({ text, values = {} }: { text: string; values?: Record<string, ReactNode> }) {
  const { href } = useSiteText();
  return <>{renderRich(text, values, href)}</>;
}

/** Sets the localized <title> and meta description for the current page. */
export function useDocumentMeta(title: string, description: string): void {
  useEffect(() => {
    document.title = title;
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute("content", description);
  }, [title, description]);
}
