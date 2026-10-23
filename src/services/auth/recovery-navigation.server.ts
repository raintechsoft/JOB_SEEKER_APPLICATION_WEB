import type { NextRequest } from "next/server";

/** First-party, CSRF-protected cancellation before a real document navigation renders. */
export async function recordRecoveryNavigation(request: NextRequest, base: string): Promise<string[]> {
  const sessionName = process.env.API_SESSION_COOKIE ?? process.env.SESSION_COOKIE ?? "skillora_session";
  const prefetch = request.headers.has("next-router-prefetch") || request.headers.has("next-router-segment-prefetch") || /prefetch|prerender/.test(request.headers.get("sec-purpose") ?? request.headers.get("purpose") ?? "");
  const destination = request.headers.get("sec-fetch-dest");
  // RSC/background requests can arrive without a prefetch marker. Actual SPA navigation
  // is handled by the client boundary; only document navigation belongs in this bridge.
  const documentNavigation = destination === "document" || (!destination && request.headers.get("accept")?.includes("text/html") && !request.headers.has("rsc"));
  if (!request.cookies.has(sessionName) || !documentNavigation || prefetch || request.method !== "GET") return [];

  const origin = process.env.FRONTEND_URL ?? request.nextUrl.origin;
  const cookies = new Map(request.cookies.getAll().map(({ name, value }) => [name, value]));
  const cookieHeader = () => [...cookies].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; ");
  const updatedCookies: string[] = [];
  if (!cookies.has("XSRF-TOKEN")) {
    const csrf = await fetch(new URL("/sanctum/csrf-cookie", base), {
      headers: { Accept: "application/json", Origin: origin, Cookie: cookieHeader() }, cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (!csrf.ok) throw new Error("Recovery navigation could not initialize its session.");
    updatedCookies.push(...csrf.headers.getSetCookie());
    for (const cookie of updatedCookies) {
      const pair = cookie.split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator > 0) cookies.set(pair.slice(0, separator), decodeURIComponent(pair.slice(separator + 1)));
    }
  }
  const xsrf = cookies.get("XSRF-TOKEN");
  if (!xsrf) throw new Error("Recovery navigation requires CSRF protection.");
  const path = request.nextUrl.pathname;
  const response = await fetch(`${base.replace(/\/$/, "")}/auth/recovery/navigation`, {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", Origin: origin, Cookie: cookieHeader(), "X-XSRF-TOKEN": decodeURIComponent(xsrf) },
    body: JSON.stringify({ screen: path === "/reset-password" ? "password" : path === "/forgot-password" ? "code" : "other" }),
    cache: "no-store", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Recovery navigation could not be confirmed (${response.status}).`);
  return updatedCookies;
}
