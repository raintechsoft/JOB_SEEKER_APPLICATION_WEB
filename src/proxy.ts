import { NextResponse, type NextRequest } from "next/server";
import { authDestination } from "@/features/auth/auth-navigation";
import type { AuthSession, RecoveryStatus } from "@/services/auth/auth.service";
import { RECOVERY_EXPIRED_PATH } from "@/features/auth/recovery-expiry";
import { recordRecoveryNavigation } from "@/services/auth/recovery-navigation.server";

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
  const unavailable = () => secure(new NextResponse("Account verification is temporarily unavailable. Please try again.", { status: 503, headers: { "Retry-After": "5" } }));
  const forbidden = () => secure(new NextResponse("You do not have access to this workspace.", { status: 403 }));
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return unavailable();
  const path = request.nextUrl.pathname;
  try {
    updatedCookies.push(...await recordRecoveryNavigation(request, base));
    const protectedPage = path === "/reset-password" || path === "/verify-email" || path === "/change-password" || path === "/onboarding" || path === "/accept-invitation" || /^\/(?:app|admin|recruiter)(?:\/|$)/.test(path);
    if (!protectedPage) return secure(NextResponse.next());
    const recovering = path === "/reset-password";
    const response = await fetch(`${base.replace(/\/$/, "")}/auth/${recovering ? "recovery" : "me"}`, {
      headers: { Accept: "application/json", Origin: process.env.FRONTEND_URL ?? request.nextUrl.origin, Cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (recovering) {
      if (!response.ok) return unavailable();
      const { data } = await response.json() as { data: RecoveryStatus };
      return data?.step === "password" ? secure(NextResponse.next()) : redirect(RECOVERY_EXPIRED_PATH);
    }
    if (response.status === 401) {
      const login = new URL(/^\/recruiter(?:\/|$)/.test(path) ? "/employer/login" : "/login", request.url);
      login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
      return secure(NextResponse.redirect(login));
    }
    if (!response.ok) return unavailable();
    const { data: session } = await response.json() as { data: AuthSession };
    if (!session?.user || !Array.isArray(session.workspaces)) return unavailable();
    if (!session.user.email_verified && path !== "/verify-email") return redirect("/verify-email");
    if (session.user.email_verified && path === "/verify-email") return redirect(authDestination(session));
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
