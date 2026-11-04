import { NextResponse, type NextRequest } from "next/server";
import { authDestination } from "@/features/auth/auth-navigation";
import type { AuthSession, RecoveryStatus } from "@/services/auth/auth.service";
import { RECOVERY_EXPIRED_PATH } from "@/features/auth/recovery-expiry";
import { recordRecoveryNavigation } from "@/services/auth/recovery-navigation.server";
import {applicationSignInReturn,isApplicationWizardRoute} from "@/features/applications/application-wizard-policy";
import {authEntryHref,continuationDestination,continuationFromParams,legacyAuthReturn,legacyPublicEntry} from "@/features/auth/auth-continuation";
import {publicEntrySchema} from "@/lib/validation/public-browsing";

/**
 * In-app (RSC) navigations reuse a verified session answer briefly instead of waiting on
 * /auth/me for every click; the guard still runs on every request, only its answer is reused.
 * Document loads always ask the API. Only successful answers are kept, keyed by session id.
 */
const SESSION_REUSE_MS = 30_000;
const verifiedSessions = new Map<string, { at: number; body: string }>();
function reusableSession(key: string | undefined) {
  if (!key) return null;
  const hit = verifiedSessions.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > SESSION_REUSE_MS) { verifiedSessions.delete(key); return null; }
  return new Response(hit.body, { status: 200, headers: { "Content-Type": "application/json" } });
}
function rememberSession(key: string, body: string) {
  if (verifiedSessions.size >= 500) verifiedSessions.delete(verifiedSessions.keys().next().value!);
  verifiedSessions.set(key, { at: Date.now(), body });
}

/** Navigation only: Laravel authorizes every read and mutation independently. */
export async function proxy(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_DATA_SOURCE === "mock" && process.env.NEXT_PUBLIC_APP_ENV === "development") return NextResponse.next();
  const updatedCookies: string[] = [];
  const secure = (response: NextResponse) => {
    response.headers.set("Cache-Control", "no-store, private");
    response.headers.set("Referrer-Policy", "no-referrer");
    for (const cookie of updatedCookies) response.headers.append("Set-Cookie", cookie);
    return response;
  };
  const redirect = (path: string) => secure(NextResponse.redirect(new URL(path, request.url)));
  const path = request.nextUrl.pathname;
  // Standalone status pages must not re-enter the session probe (that caused the outage).
  if (path === "/service-unavailable" || path === "/access-denied") return secure(NextResponse.next());
  const unavailable = () => {
    const target = new URL("/service-unavailable", request.url);
    const retry = request.nextUrl.pathname + request.nextUrl.search;
    if (/^\/(?:app|recruiter|admin|verify-email|change-password|onboarding|accept-invitation|reset-password)(?:\/|$|\?)/.test(retry)) {
      target.searchParams.set("next", retry);
    }
    const response = NextResponse.redirect(target);
    response.headers.set("Retry-After", "5");
    return secure(response);
  };
  const forbidden = () => secure(NextResponse.redirect(new URL("/access-denied", request.url)));
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return unavailable();
  const resolveLegacyPublicEntry=async()=>{
    const target=legacyPublicEntry(path,request.nextUrl.searchParams);if(!target)return null;
    const entryId=new URL(target,request.url).pathname.split("/")[2];
    try{
      const eligibility=await fetch(`${base.replace(/\/$/,"")}/public/feed/${entryId}`,{headers:{Accept:"application/json",Origin:process.env.FRONTEND_URL??request.nextUrl.origin},cache:"no-store",signal:AbortSignal.timeout(5000)});
      if(eligibility.ok){const payload=await eligibility.json(),entry=publicEntrySchema.safeParse(payload?.data);if(entry.success&&entry.data.id===entryId)return target;}
    }catch{ /* Failed/disabled public eligibility never grants access to a private source. */ }
    return null;
  };
  try {
    const recovering = path === "/reset-password";
    const protectedPage = recovering || path === "/verify-email" || path === "/change-password" || path === "/onboarding" || path === "/accept-invitation" || /^\/(?:app|admin|recruiter)(?:\/|$)/.test(path);
    const accountEntry = ["/login", "/signup", "/employer/login", "/employer/register"].includes(path);
    const platformEntry = path === "/" || path === "/feed";
    // Workspace loads must reach /auth/me without waiting on recovery cancellation.
    // php artisan serve is single-threaded and file sessions lock, so an extra POST
    // before /auth/me can exceed the proxy budget and surface a false outage.
    // Skip recovery probes on account/home entry — those already call /auth/me next.
    if ((!protectedPage || recovering) && !accountEntry && !platformEntry) {
      try {
        updatedCookies.push(...await recordRecoveryNavigation(request, base));
      } catch {
        // Best-effort: leaving reset still expires on its own deadline. Routing uses
        // /auth/me or /auth/recovery below.
      }
    }
    const sessionCookie = process.env.API_SESSION_COOKIE ?? process.env.SESSION_COOKIE ?? "skillora_session";
    if (!protectedPage && ((!accountEntry&&!platformEntry) || !request.cookies.has(sessionCookie))) return secure(NextResponse.next());
    const sessionId = request.cookies.get(sessionCookie)?.value;
    // Browsers mark in-app (fetch) navigations "empty" and page loads "document"; page scripts cannot set this header.
    const clientNavigation = request.headers.get("sec-fetch-dest") === "empty" &&/^\/(?:app|recruiter)(?:\/|$)/.test(path);
    const reused = clientNavigation ? reusableSession(sessionId) : null;
    // Local artisan serve serializes requests; give development a wider window than production.
    const sessionBudgetMs = process.env.NODE_ENV === "development" ? 15_000 : 5_000;
    const response = reused ?? await fetch(`${base.replace(/\/$/, "")}/auth/${recovering ? "recovery" : "me"}`, {
      headers: { Accept: "application/json", Origin: process.env.FRONTEND_URL ?? request.nextUrl.origin, Cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store", signal: AbortSignal.timeout(sessionBudgetMs),
    });
    // Remember a verified answer so the same session's next in-app clicks don't wait on the API.
    if (!reused && !recovering && response.ok && sessionId) rememberSession(sessionId, await response.clone().text());
    if (recovering) {
      if (!response.ok) return unavailable();
      const { data } = await response.json() as { data: RecoveryStatus };
      return data?.step === "password" ? secure(NextResponse.next()) : redirect(RECOVERY_EXPIRED_PATH);
    }
    if (response.status === 401) {
      if (accountEntry||platformEntry) return secure(NextResponse.next());
      const publicEntry=await resolveLegacyPublicEntry();if(publicEntry)return redirect(publicEntry);
      // Onboarding is temporarily hidden; do not return guests to /onboarding after login.
      if (path === "/onboarding") return redirect("/login");
      const login = new URL(/^\/recruiter(?:\/|$)/.test(path) ? "/employer/login" : "/login", request.url);
      login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
      return secure(NextResponse.redirect(login));
    }
    // Guest entry and marketing home must stay reachable during API outages so people can
    // sign in again instead of bouncing forever on /service-unavailable.
    if (!response.ok) return accountEntry || platformEntry ? secure(NextResponse.next()) : unavailable();
    const { data: session } = await response.json() as { data: AuthSession };
    if (!session?.user || !Array.isArray(session.workspaces)) return accountEntry || platformEntry ? secure(NextResponse.next()) : unavailable();
    if(platformEntry)return redirect(authDestination(session));
    // Account-entry forms are for guests. Visiting one never discards a valid
    // session or changes the selected professional/employer workspace.
    const applicationReturn=applicationSignInReturn(request.nextUrl.searchParams.get("next"));
    const professional=session.workspaces.some(workspace=>workspace.id===session.selected_identity_id&&workspace.kind==="professional");
    const continuation=continuationFromParams(request.nextUrl.searchParams);
    // Google finishes session adoption and consumes its tab-bound continuation in the client.
    if(accountEntry&&path==="/login"&&(request.nextUrl.searchParams.get("google")==="success"||request.nextUrl.searchParams.has("google_error")))return secure(NextResponse.next());
    if (accountEntry) return redirect(continuation?continuationDestination(continuation,session):professional&&session.user.email_verified&&applicationReturn?applicationReturn:session.user.email_verified?legacyAuthReturn(request.nextUrl.searchParams.get("next"),session)??authDestination(session):authDestination(session));
    if (!session.user.email_verified && path !== "/verify-email") return redirect(continuation?authEntryHref("/verify-email",continuation):"/verify-email"+(isApplicationWizardRoute(path)?"?next="+encodeURIComponent(path+request.nextUrl.search):""));
    if (session.user.email_verified && path === "/verify-email") return redirect(continuation?continuationDestination(continuation,session):professional&&applicationReturn?applicationReturn:legacyAuthReturn(request.nextUrl.searchParams.get("next"),session)??authDestination(session));
    // Temporarily hide /onboarding, including typed URLs, until it is part of the live signup path.
    if (path === "/onboarding") return redirect(authDestination(session));
    const selected=session.workspaces.find(workspace=>workspace.id===session.selected_identity_id);
    if(session.user.email_verified&&selected&&((path==="/recruiter/dashboard"&&selected.kind!=="recruiter")||(path==="/app/dashboard"&&selected.kind!=="professional"))){const publicEntry=await resolveLegacyPublicEntry();if(publicEntry)return redirect(publicEntry);}
    if (path.startsWith("/recruiter/") && !session.workspaces.some((workspace) => workspace.kind === "recruiter")) return forbidden();
    if (path === "/admin" || path.startsWith("/admin/")) {
      const permission = await fetch(`${base.replace(/\/$/, "")}/admin/session`, {
        headers: { Accept: "application/json", Origin: process.env.FRONTEND_URL ?? request.nextUrl.origin, Cookie: request.headers.get("cookie") ?? "" },
        cache: "no-store", signal: AbortSignal.timeout(5000),
      });
      if (permission.status === 403) return forbidden();
      if (!permission.ok) return unavailable();
    }
    return secure(NextResponse.next());
  } catch {
    if (["/login", "/signup", "/employer/login", "/employer/register"].includes(path) || path === "/" || path === "/feed") {
      return secure(NextResponse.next());
    }
    return unavailable();
  }
}

// Check prefetches too: client-supplied headers cannot skip prerequisite guards.
export const config = { matcher: [
  "/((?!api(?:/|$)|_next(?:/|$)|images(?:/|$)|fonts(?:/|$)|favicon.ico$|icon.svg$|robots.txt$|sitemap.xml$).*)",
  // Opening an API/asset URL in the address bar is departure too. Ordinary
  // subresource requests remain excluded and never cancel password recovery.
  { source: "/:path*", has: [{ type: "header", key: "sec-fetch-dest", value: "document" }] },
] };
