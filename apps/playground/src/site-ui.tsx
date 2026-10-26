import { useId, type ReactNode } from "react";
import { publicNavigation, type PublicRoute } from "./site-chrome";
import { localeNames, setSiteLocale, siteLocales, useSiteText, type SiteLocale } from "./i18n/site-i18n";

const navigationKey = { demo: "demo", "get-started": "getStarted", marks: "marks", docs: "docs" } as const;

/** Header language switcher; each option is written in its own language. */
export function LanguageSwitcher() {
  const { locale, t } = useSiteText();
  const id = useId();
  return <div className="site-language">
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.1">
      <circle cx="8" cy="8" r="6.25" /><path d="M1.75 8h12.5M8 1.75c1.8 1.7 2.7 3.8 2.7 6.25S9.8 12.55 8 14.25M8 1.75C6.2 3.45 5.3 5.55 5.3 8s.9 4.55 2.7 6.25" />
    </svg>
    <label className="visually-hidden" htmlFor={id}>{locale === "en" ? t.common.language : `${t.common.language} (Language)`}</label>
    <select id={id} value={locale} onChange={(event) => { void setSiteLocale(event.target.value as SiteLocale); }}>
      {siteLocales.map((option) => <option key={option} value={option} lang={option}>{localeNames[option]}</option>)}
    </select>
  </div>;
}

export function SiteHeader({ active }: { active?: PublicRoute }) {
  const { t, href, localized } = useSiteText();
  return (
    <header className="site-header">
      <a className="site-wordmark" href={href("/")} aria-label={t.common.wordmarkLabel} aria-current={active === "overview" ? "page" : undefined}>proofmarks</a>
      <nav className="site-navigation" aria-label={t.common.primaryNavigation}>
        {publicNavigation.map(({ id, href: path }) => (
          <a key={id} href={href(path)} aria-current={id === active ? "page" : undefined}>
            {t.common.nav[navigationKey[id as keyof typeof navigationKey]]}
          </a>
        ))}
      </nav>
      {localized ? <LanguageSwitcher /> : null}
    </header>
  );
}

export function SiteFooter() {
  const { t, href } = useSiteText();
  const [first, second] = t.common.footerTagline.split("\n");
  return (
    <footer className="site-footer">
      <div>
        <a className="site-wordmark" href={href("/")}>proofmarks</a>
        <p>{first}{second ? <><br />{second}</> : null}</p>
      </div>
      <nav aria-label={t.common.footerNavigation}>
        <a href={href("/docs")}>{t.common.footerDocs}</a>
        <a href={href("/docs#references")}>{t.common.footerReferences}</a>
        <a href="https://github.com/cguodesign/proofmarks">
          GitHub <span aria-hidden="true">↗</span>
        </a>
      </nav>
    </footer>
  );
}

export function SectionHeading({
  label,
  title,
  children,
}: {
  label?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className={`section-heading${label ? "" : " section-heading--plain"}`}>
      {label ? <p className="small-label">{label}</p> : null}
      <div>
        <h2>{title}</h2>
        {children ? <div className="section-intro">{children}</div> : null}
      </div>
    </header>
  );
}

export function CodeBlock({ children, label }: { children: string; label?: string }) {
  return (
    <figure className="site-code-block">
      {label ? <figcaption>{label}</figcaption> : null}
      <pre><code>{children}</code></pre>
    </figure>
  );
}
