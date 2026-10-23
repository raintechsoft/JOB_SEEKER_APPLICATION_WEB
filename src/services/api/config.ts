/**
 * Frontend data-source configuration.
 *
 * `NEXT_PUBLIC_DATA_SOURCE=mock` explicitly opts into the development prototype.
 * `NEXT_PUBLIC_DATA_SOURCE=http` uses the Laravel API at `NEXT_PUBLIC_API_BASE_URL`.
 * Never put secrets in `NEXT_PUBLIC_*` variables: they are embedded in the client bundle.
 */
export type DataSource = "mock" | "http";

export const apiConfig = {
  dataSource: (process.env.NEXT_PUBLIC_DATA_SOURCE === "mock" && process.env.NEXT_PUBLIC_APP_ENV === "development" ? "mock" : "http") as DataSource,
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
};
