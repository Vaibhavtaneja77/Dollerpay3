"use client";

const CSRF_COOKIE = "dollerpay_csrf";
const CSRF_HEADER = "x-csrf-token";

function readCookie(name: string) {
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

export function csrfFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = readCookie(CSRF_COOKIE);

  if (token) {
    headers.set(CSRF_HEADER, decodeURIComponent(token));
  }

  return fetch(input, {
    ...init,
    headers
  });
}
