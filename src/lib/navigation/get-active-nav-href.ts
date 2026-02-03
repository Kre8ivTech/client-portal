function normalizePath(path: string) {
  if (path.length > 1) return path.replace(/\/+$/, "");
  return path;
}

/**
 * Returns the most specific (longest) matching href for a given pathname.
 * This prevents multiple sidebar items from being highlighted at once when
 * both a parent and child route match.
 */
export function getActiveNavHref(
  pathname: string,
  hrefs: string[],
  options?: { exactOnlyHrefs?: string[] },
): string | null {
  const exactOnly = new Set(options?.exactOnlyHrefs ?? ["/dashboard"]);
  const p = normalizePath(pathname);

  const candidates = hrefs
    .map(normalizePath)
    .filter((href) => {
      if (href === "/") return p === "/";
      if (exactOnly.has(href)) return p === href;
      return p === href || p.startsWith(href + "/");
    })
    .sort((a, b) => b.length - a.length);

  return candidates[0] ?? null;
}

