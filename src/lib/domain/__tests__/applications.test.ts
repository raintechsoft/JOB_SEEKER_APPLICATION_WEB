import { describe, expect, it } from "vitest";
import { APPLICATION_FILTER_GROUPS, mockApplicationResults } from "@/lib/domain/applications";
import type { ApplicationRecord } from "@/services/applications/applications.service";
import type { ApplicationStatus } from "@/types/domain";

const rows = (...statuses: ApplicationStatus[]) => statuses.map((status, i) => ({ id: `a${i}`, status }) as ApplicationRecord);

describe("application filter groups (contracts/validation/application.json)", () => {
  it("keeps Applied and Offer out of both dropdown groups", () => {
    expect(APPLICATION_FILTER_GROUPS["in-progress"]).toEqual(["In review", "Shortlisted", "Interview"]);
    expect(APPLICATION_FILTER_GROUPS.other).toEqual(["Hired", "Rejected", "Withdrawn"]);
  });

  it("counts every status and each group", () => {
    const { counts } = mockApplicationResults(rows("Applied", "Shortlisted", "Interview", "Offer", "Rejected"), "");
    expect(counts).toMatchObject({ all: 5, inProgress: 2, other: 1 });
    expect(counts.statuses.Offer).toBe(1);
  });

  it("filters by a group or by a single status", () => {
    const data = rows("Applied", "Shortlisted", "Interview", "Withdrawn");
    expect(mockApplicationResults(data, "in-progress").items.map(r => r.status)).toEqual(["Shortlisted", "Interview"]);
    expect(mockApplicationResults(data, "other").items.map(r => r.status)).toEqual(["Withdrawn"]);
    expect(mockApplicationResults(data, "Applied").items).toHaveLength(1);
    expect(mockApplicationResults(data, "").items).toHaveLength(4);
  });
});
