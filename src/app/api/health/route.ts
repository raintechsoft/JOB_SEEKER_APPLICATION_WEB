import { apiConfig } from "@/services/api/config";

/** Liveness probe for the frontend deployment. This is not a business API. */
export function GET() {
  return Response.json({ status: "ok", service: "skillora-web", dataSource: apiConfig.dataSource });
}

