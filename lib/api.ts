import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { humanizeError } from "@/lib/utils";

const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...SECURITY_HEADERS,
      ...Object.fromEntries(new Headers(init?.headers))
    }
  });
}

export function fail(error: unknown, status = 400) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: error.flatten().fieldErrors },
      { status: 422, headers: SECURITY_HEADERS }
    );
  }

  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String(error.message)
      : undefined;
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : undefined;
  console.error(error);
  if (code === "2201B") {
    return NextResponse.json(
      { error: "Payment validation is using an old database constraint. Apply migration 202608090004 and try again." },
      { status, headers: SECURITY_HEADERS }
    );
  }
  return NextResponse.json({ error: humanizeError(message) }, { status, headers: SECURITY_HEADERS });
}
