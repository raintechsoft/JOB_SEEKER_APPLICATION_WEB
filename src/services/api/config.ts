/**
 * Frontend data-source configuration.
 *
 * `NEXT_PUBLIC_DATA_SOURCE=mock` (default) uses the browser-local mock backend.
 * `NEXT_PUBLIC_DATA_SOURCE=http` is reserved for the future NestJS API at `NEXT_PUBLIC_API_BASE_URL`.
 * Never put secrets in `NEXT_PUBLIC_*` variables: they are embedded in the client bundle.
 */
export type DataSource = "mock" | "http";

export const apiConfig = {
  dataSource: (process.env.NEXT_PUBLIC_DATA_SOURCE === "http" ? "http" : "mock") as DataSource,
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
};
