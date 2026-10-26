import { describe, expect, expectTypeOf, it } from "vitest";
import { en, type SiteDictionary } from "./en";
import { ja } from "./ja";
import { ko } from "./ko";
import { localeFromLanguages, localeFromQuery, localizedHref, matchLocale, siteLocales } from "./locale";
import { richInvariants } from "./site-i18n";
import { zhHans } from "./zh-hans";
import { zhHant } from "./zh-hant";

const dictionaries = { en, ja, "zh-Hans": zhHans, "zh-Hant": zhHant, ko } satisfies Record<(typeof siteLocales)[number], SiteDictionary>;

function leaves(value: unknown, path = ""): Array<[string, string]> {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  }
  throw new Error(`Unexpected dictionary value at ${path}`);
}

const englishLeaves = new Map(leaves(en));

describe("site dictionaries", () => {
  it("are typed against the English shape", () => {
    expectTypeOf(ja).toEqualTypeOf<SiteDictionary>();
    // A missing key must be a type error.
    // @ts-expect-error -- `common` is required
    const incomplete: SiteDictionary = { ...ja, common: undefined };
    expect(incomplete).toBeDefined();
  });

  for (const [locale, dictionary] of Object.entries(dictionaries)) {
    it(`${locale} has exactly the English keys and no empty strings`, () => {
      const entries = leaves(dictionary);
      expect(entries.map(([path]) => path).sort()).toEqual([...englishLeaves.keys()].sort());
      for (const [path, text] of entries) expect(text.trim(), `${locale} ${path}`).not.toBe("");
    });

    it(`${locale} keeps code, links and placeholders identical to English`, () => {
      for (const [path, text] of leaves(dictionary)) {
        expect(richInvariants(text), `${locale} ${path}`).toEqual(richInvariants(englishLeaves.get(path)!));
      }
    });
  }

  it("keeps standard names exactly as published", () => {
    for (const dictionary of Object.values(dictionaries)) {
      const text = leaves(dictionary).map(([, value]) => value).join("\n");
      expect(text).toContain("CNS 3927");
      expect(text).toContain("CNS Online");
      expect(text).toMatch(/BSMI[^。.\n]*2026/u);
      expect(text).toMatch(/Hancom|한컴/u);
      expect(text).toMatch(/转移[、, ]+加大空距[、, ]+减小空距/u);
    }
  });

  it("differs from English wherever a translation is expected", () => {
    const sameAsEnglish = new Set([
      "docs.labels.react", "docs.labels.helpers", "docs.labels.css", "docs.compatibility.react",
      "docs.compatibility.browsers", "docs.compatibility.licenseStatus", "common.quote",
    ]);
    for (const [locale, dictionary] of Object.entries(dictionaries)) {
      if (locale === "en") continue;
      for (const [path, text] of leaves(dictionary)) {
        if (sameAsEnglish.has(path) || path.startsWith("home.traditions")) continue;
        expect(text, `${locale} ${path} is untranslated`).not.toBe(englishLeaves.get(path));
      }
    }
  });
});

describe("site locale selection", () => {
  it("maps browser languages", () => {
    expect(matchLocale("zh-TW")).toBe("zh-Hant");
    expect(matchLocale("zh-HK")).toBe("zh-Hant");
    expect(matchLocale("zh-Hant-CN")).toBe("zh-Hant");
    expect(matchLocale("zh")).toBe("zh-Hans");
    expect(matchLocale("zh-CN")).toBe("zh-Hans");
    expect(matchLocale("zh-Hans-TW")).toBe("zh-Hans");
    expect(matchLocale("ja-JP")).toBe("ja");
    expect(matchLocale("ko-KR")).toBe("ko");
    expect(matchLocale("fr-FR")).toBeNull();
    expect(localeFromLanguages(["fr-FR", "ko", "en"])).toBe("ko");
    expect(localeFromLanguages(["fr-FR", "de"])).toBe("en");
  });

  it("reads ?lang= ids and aliases", () => {
    expect(localeFromQuery("?lang=zh-Hant")).toBe("zh-Hant");
    expect(localeFromQuery("?lang=zh-TW")).toBe("zh-Hant");
    expect(localeFromQuery("?lang=xx")).toBeNull();
    expect(localeFromQuery("")).toBeNull();
  });

  it("keeps the language on internal links only", () => {
    expect(localizedHref("/docs#helpers", "ja")).toBe("/docs?lang=ja#helpers");
    expect(localizedHref("/", "ko")).toBe("/?lang=ko");
    expect(localizedHref("#room", "ja")).toBe("#room");
    expect(localizedHref("/llms.txt", "ja")).toBe("/llms.txt");
    expect(localizedHref("/demo", "ja")).toBe("/demo");
    expect(localizedHref("https://example.com/", "ja")).toBe("https://example.com/");
  });
});
