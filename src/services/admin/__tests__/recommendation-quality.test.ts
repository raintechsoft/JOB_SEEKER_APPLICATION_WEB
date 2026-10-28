import { describe, expect, it, vi } from "vitest";
import { createHttpAdminService } from "@/services/admin/admin.http";
import type { HttpClient } from "@/services/api/client";

describe("admin recommendation quality", () => {
  it("reads the report for a bounded period", async () => {
    const report = { days: 14, generatedAt: new Date().toISOString(), minimumServed: 500, windowHours: 24, surfaces: [], search: [] };
    const get = vi.fn(async () => ({ data: report }));
    const admin = createHttpAdminService({ get } as unknown as HttpClient);
    await expect(admin.recommendationQuality!(14)).resolves.toEqual(report);
    expect(get).toHaveBeenCalledWith("admin/recommendation-quality", { days: 14 });
    await expect(admin.recommendationQuality!(365)).rejects.toThrow();
  });
});
