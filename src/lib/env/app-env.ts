/**
 * Application environment.
 *
 * `NEXT_PUBLIC_APP_ENV=development` shows development-only UI: demo logins, the admin demo,
 * on-screen OTP codes, reset controls, simulation controls and prototype/demo notices.
 * Any other value (or no value) is treated as `production` and hides them.
 *
 * The value is inlined into the client bundle at build time, so rebuild after changing it.
 */
export type AppEnv = "development" | "production";

export const appEnv: AppEnv = process.env.NEXT_PUBLIC_APP_ENV === "development" ? "development" : "production";

export const isDevelopment = appEnv === "development";

/** Picks development copy (which may mention the demo or prototype) or neutral production copy. */
export function devCopy<T>(development: T, production: T): T {
  return isDevelopment ? development : production;
}
