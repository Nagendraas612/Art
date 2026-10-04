/**
 * Canonical application URL.
 *
 * NEXT_PUBLIC_APP_URL is set by hand in the Vercel dashboard, so it arrives
 * in all shapes: with/without protocol, with/without trailing slash.
 * Every email link and redirect built from it must go through here,
 * otherwise we produce mangled URLs like
 * `kalaabhadra.vercel.app/https:/kalaabhadra.vercel.app/admin/creators`
 * (the admin-alert 404 of Oct 2026).
 */
export function getAppUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    "http://localhost:3000";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

/** Join the app URL with a path, tolerating a path-or-full-URL input. */
export function appUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = getAppUrl();
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}
