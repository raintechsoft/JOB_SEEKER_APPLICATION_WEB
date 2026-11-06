import { headers } from "next/headers";

/**
 * Absolute site origin for server-rendered absolute URLs (Open Graph, canonical, media proxy).
 * Configured through NEXT_PUBLIC_SITE_URL, else derived from the request's own host. Server only.
 */
export async function siteOrigin(): Promise<string | null> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      return null;
    }
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
