import "dotenv/config";
import type { CookieOptions } from "express";

function shouldUseSecureCookies(): boolean {
  const publicAppUrl = process.env.PUBLIC_APP_URL;

  if (!publicAppUrl) {
    throw new Error("Falta PUBLIC_APP_URL");
  }

  return publicAppUrl.startsWith("https://");
}

export function temporaryCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60 * 1000,
  };
}

export function temporaryCookieClearOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
  };
}

export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: shouldUseSecureCookies(),
  sameSite: "lax",
  path: "/",
  maxAge: 24 * 60 * 60 * 1000,
};

export const sessionCookieClearOptions: CookieOptions = {
  httpOnly: true,
  secure: shouldUseSecureCookies(),
  sameSite: "lax",
  path: "/",
};