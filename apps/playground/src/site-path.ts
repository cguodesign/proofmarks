/** Resolve site links under Vite's deployment base without changing external URLs. */
export function siteHref(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  return `${import.meta.env.BASE_URL}${path.slice(1)}`;
}

/** Route matching ignores the deployment prefix and static-host trailing slash. */
export function sitePathname(pathname: string): string {
  const base = import.meta.env.BASE_URL;
  const path = pathname.startsWith(base) ? `/${pathname.slice(base.length)}` : pathname;
  return path.replace(/\/+$/, "") || "/";
}
