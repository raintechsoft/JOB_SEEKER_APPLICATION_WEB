import { describe, expect, it, vi } from "vitest";
import { createHttpPersonalizationService } from "@/services/personalization/personalization.http";
import type { HttpClient } from "@/services/api/client";

describe("personalisation choices", () => {
  it("reads, switches and clears, telling the tracker about every switch", async () => {
    const get = vi.fn(async () => ({ data: { personalize: true, searchHistory: true } }));
    const patch = vi.fn(async (_path: string, body: { key: string; value: boolean }) => ({ data: { personalize: body.key === "personalize" ? body.value : true, searchHistory: true } }));
    const del = vi.fn(async () => undefined);
    const onChange = vi.fn();
    const service = createHttpPersonalizationService({ get, patch, delete: del } as unknown as HttpClient, onChange);
    await expect(service.get()).resolves.toEqual({ personalize: true, searchHistory: true });
    await expect(service.set("personalize", false)).resolves.toEqual({ personalize: false, searchHistory: true });
    expect(patch).toHaveBeenCalledWith("me/personalization", { key: "personalize", value: false });
    expect(onChange).toHaveBeenCalledWith({ personalize: false, searchHistory: true });
    await service.clearHistory();
    expect(del).toHaveBeenCalledWith("me/personalization/history");
    await expect(service.set("tracking" as never, true)).rejects.toThrow();
  });
});
