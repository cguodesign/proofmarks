import { siteHref } from "./site-path";
export type PublicRoute = "overview" | "demo" | "get-started" | "marks" | "docs";

export const publicNavigation: ReadonlyArray<{
  id: PublicRoute;
  href: string;
  label: string;
}> = [
  { id: "demo", href: "/demo", label: "Demo" },
  { id: "get-started", href: "/get-started", label: "Get started" },
  { id: "marks", href: "/marks", label: "Marks" },
  { id: "docs", href: "/docs", label: "Docs" },
];

export function publicHeaderMarkup(active: PublicRoute): string {
  return `
    <header class="site-header">
      <a class="site-wordmark" href="${siteHref("/")}" aria-label="proofmarks overview"${active === "overview" ? ' aria-current="page"' : ""}>proofmarks</a>
      <nav class="site-navigation" aria-label="Primary navigation">
        ${publicNavigation
          .map(
            ({ id, href, label }) =>
              `<a href="${siteHref(href)}"${id === active ? ' aria-current="page"' : ""}>${label}</a>`,
          )
          .join("")}
      </nav>
    </header>`;
}

export function publicFooterMarkup(): string {
  return `
    <footer class="site-footer">
      <div>
        <a class="site-wordmark" href="${siteHref("/")}">proofmarks</a>
        <p>Reference-based proofreading notation<br>for browser typography. MIT License.</p>
      </div>
      <nav aria-label="Footer navigation">
        <a href="${siteHref("/docs")}">Docs</a>
        <a href="${siteHref("/docs#references")}">References</a>
        <a href="https://github.com/cguodesign/proofmarks">GitHub <span aria-hidden="true">↗</span></a>
      </nav>
    </footer>`;
}
