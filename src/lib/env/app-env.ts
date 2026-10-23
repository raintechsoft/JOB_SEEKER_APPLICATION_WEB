/**
 * Application environment.
 *
 * `NEXT_PUBLIC_APP_ENV=development` shows development-only UI: demo logins, the admin demo,
 * on-screen OTP codes, reset controls, simulation controls and prototype/demo notices.
 * Prototype controls additionally require an explicit mock data source. HTTP mode always uses
 * neutral product copy and hides simulated review/login controls. Any other environment value
 * (or no value) is treated as `production`.
 *
 * The value is inlined into the client bundle at build time, so rebuild after changing it.
 */
import { apiConfig } from "@/services/api/config";

export type AppEnv = "development" | "production";

export const appEnv: AppEnv = process.env.NEXT_PUBLIC_APP_ENV === "development" ? "development" : "production";

export const isDevelopment = appEnv === "development";
export const isPrototype = isDevelopment && apiConfig.dataSource === "mock";

/** Picks development copy (which may mention the demo or prototype) or neutral production copy. */
export function devCopy<T>(development: T, production: T): T {
  return isPrototype ? development : production;
}
