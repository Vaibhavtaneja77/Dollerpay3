import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

const ALLOWED_CORS_ORIGINS = new Set(
  (process.env.APP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean)
);

const CSRF_COOKIE = "dollerpay_csrf";
const REFERRAL_COOKIE = "dollerpay_referral";
const CSRF_HEADER = "x-csrf-token";
const UNSAFE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function makeCsrfToken() {
  return crypto.randomUUID();
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function hasValidCsrf(request: NextRequest) {
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get(CSRF_HEADER);
  return Boolean(cookieToken && headerToken && cookieToken === headerToken);
}

function applyCsrfCookie(request: NextRequest, response: NextResponse) {
  if (request.cookies.get(CSRF_COOKIE)) return response;

  response.cookies.set(CSRF_COOKIE, makeCsrfToken(), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
  return response;
}

function applyCorsHeaders(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get("origin");
  if (!origin || !ALLOWED_CORS_ORIGINS.has(origin)) return response;

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-CSRF-Token");
  response.headers.set("Vary", "Origin");
  return response;
}

function getReferralCode(request: NextRequest) {
  const referralCode = request.nextUrl.searchParams.get("ref")?.trim().toUpperCase();
  if (!referralCode || !/^[A-Z0-9_-]{4,20}$/.test(referralCode)) return null;
  return referralCode;
}

function applyReferralCookie(request: NextRequest, response: NextResponse) {
  const referralCode = getReferralCode(request);
  if (!referralCode) return response;

  response.cookies.set(REFERRAL_COOKIE, referralCode, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  return response;
}

function finalizeResponse(request: NextRequest, response: NextResponse) {
  return applyReferralCookie(request, applyCsrfCookie(request, applyCorsHeaders(request, response)));
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && UNSAFE_METHODS.has(request.method)) {
    if (!isSameOrigin(request) || !hasValidCsrf(request)) {
      return NextResponse.json({ error: "Invalid security token. Refresh the page and try again." }, { status: 403 });
    }
  }

  if (request.method === "OPTIONS") {
    return applyCorsHeaders(request, new NextResponse(null, { status: 204 }));
  }

  const referralCode = getReferralCode(request);
  if (referralCode) request.cookies.set(REFERRAL_COOKIE, referralCode);

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const { data } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = ["/login", "/register", "/forgot-password"].includes(pathname);
  const isBannedRoute = pathname === "/banned";
  const isMaintenanceRoute = pathname === "/maintenance";
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  const isApiRoute = pathname.startsWith("/api/");
  const protectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/referrals") ||
    pathname.startsWith("/sell") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/wallet") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/admin");
  const customerRoute = protectedRoute && !isAdminRoute;

  if (pathname === "/") {
    return finalizeResponse(request, NextResponse.redirect(new URL("/login", request.url)));
  }

  if (!data.user && protectedRoute) {
    return finalizeResponse(request, NextResponse.redirect(new URL("/login", request.url)));
  }

  if (data.user && isAuthRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role,onboarding_completed,status,email")
      .eq("id", data.user.id)
      .single();
    if (profile?.status === "banned") {
      const url = new URL("/banned", request.url);
      if (profile.email) url.searchParams.set("email", profile.email);
      return finalizeResponse(request, NextResponse.redirect(url));
    }
    if (profile?.role === "admin") return finalizeResponse(request, NextResponse.redirect(new URL("/admin", request.url)));
    return finalizeResponse(request, NextResponse.redirect(new URL(profile?.onboarding_completed ? "/dashboard" : "/onboarding", request.url)));
  }

  if (!data.user && isMaintenanceRoute) {
    return finalizeResponse(request, NextResponse.redirect(new URL("/login", request.url)));
  }

  if (data.user && (protectedRoute || isBannedRoute || isMaintenanceRoute || isApiRoute)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role,status,email,onboarding_completed")
      .eq("id", data.user.id)
      .single();

    if (profile?.status === "banned" && !isBannedRoute) {
      const url = new URL("/banned", request.url);
      if (profile.email) url.searchParams.set("email", profile.email);
      return finalizeResponse(request, NextResponse.redirect(url));
    }

    if (isBannedRoute && profile?.status !== "banned") {
      const destination = profile?.role === "admin" ? "/admin" : profile?.onboarding_completed ? "/dashboard" : "/onboarding";
      return finalizeResponse(request, NextResponse.redirect(new URL(destination, request.url)));
    }

    if (profile?.role !== "admin") {
      const { data: settings } = await supabase
        .from("platform_settings")
        .select("maintenance_mode")
        .eq("id", 1)
        .maybeSingle();

      if (!settings?.maintenance_mode && isMaintenanceRoute) {
        return finalizeResponse(request, NextResponse.redirect(new URL("/dashboard", request.url)));
      }

      if (settings?.maintenance_mode && !isMaintenanceRoute) {
        if (isApiRoute) {
          return finalizeResponse(request, NextResponse.json({ error: "Maintenance mode is active. Please try again shortly." }, { status: 503 }));
        }
        if (customerRoute) {
          return finalizeResponse(request, NextResponse.redirect(new URL("/maintenance", request.url)));
        }
      }
    }
  }

  return finalizeResponse(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
