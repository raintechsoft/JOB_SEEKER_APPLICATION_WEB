/** Liveness probe for the frontend deployment. This is not a business API. */
export function GET() {
  return Response.json({ status: "ok", service: "skillora-web", dataSource: process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock" });
}
