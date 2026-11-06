import { z } from "zod";
import { apiConfig } from "@/services/api/config";
import { siteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

/**
 * Crawler-reachable copy of a public media download, used for Open Graph images on public entry
 * pages. Link crawlers never carry a session or a first-party Referer, which the API requires, so
 * the page proxies the bytes. The request to the API carries no credentials: the API alone decides
 * that the asset belongs to currently public content, exactly as it does for a guest in the browser.
 */
export async function GET(_request: Request, context: { params: Promise<{ asset: string }> }) {
  const asset = z.uuid().safeParse((await context.params).asset);
  if (!asset.success || apiConfig.dataSource !== "http" || !apiConfig.baseUrl) return new Response(null, { status: 404 });
  const site = await siteOrigin();
  if (!site) return new Response(null, { status: 404 });
  const api = new URL(apiConfig.baseUrl);
  let upstream: Response;
  try {
    upstream = await fetch(new URL(`${api.pathname.replace(/\/$/, "")}/media/${asset.data}/download`, api.origin), {
      headers: { Accept: "image/*", Origin: site, Referer: site + "/" },
      cache: "no-store",
      redirect: "follow",
    });
  } catch {
    return new Response(null, { status: 502 });
  }
  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !type.startsWith("image/")) return new Response(null, { status: upstream.status === 404 ? 404 : 403 });
  const length = upstream.headers.get("content-length");
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      ...(length ? { "Content-Length": length } : {}),
    },
  });
}
