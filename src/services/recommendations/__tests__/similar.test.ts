import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, resetDb } from "@/mocks/store/demo-db";
import { mockRecommendationsService } from "@/services/recommendations/recommendations.mock";
import { createHttpRecommendationsService } from "@/services/recommendations/recommendations.http";
import type { HttpClient } from "@/services/api/client";
import type { AuthService } from "@/services/auth/auth.service";

const IDENTITY = "11111111-1111-4111-8111-111111111111";
const JOB = "22222222-2222-4222-8222-222222222222";
const auth = { me: async () => ({ selected_identity_id: IDENTITY }) } as unknown as AuthService;

describe("similar jobs and candidates", () => {
  beforeEach(() => resetDb());

  it("asks the selected workspace for similar items with a bounded limit", async () => {
    const job = { id: JOB, title: "Backend Engineer", location: "Pune", arrangement: "Remote", employment: "Full-time", salary: "", createdAt: new Date().toISOString() };
    const get = vi.fn(async () => ({ data: { kind: "job", items: [{ id: JOB, reason: "Similar role", job, company: { id: "c1", name: "Nimbus" }, saved: false, matchedAlerts: [], match: null }] } }));
    const service = createHttpRecommendationsService({ get } as unknown as HttpClient, auth);
    const jobs = await service.similarJobs(JOB, 40);
    expect(get).toHaveBeenCalledWith(`me/recommendations/${IDENTITY}/similar`, { kind: "job", id: JOB, limit: 10 });
    expect(jobs.map((j) => [j.id, j.title, j.reason])).toEqual([[JOB, "Backend Engineer", "Similar role"]]);
    await expect(service.similarPeople("not-a-uuid")).rejects.toThrow();
  });

  it("demo mode ranks by shared skills and never returns the item itself", async () => {
    const db = getDb();
    const source = db.social.jobs.find((job) => job.skills.length > 1)!;
    const jobs = await mockRecommendationsService.similarJobs(source.id, 4);
    expect(jobs.map((j) => j.id)).not.toContain(source.id);
    for (const job of jobs) expect(db.social.jobs.find((j) => j.id === job.id)!.skills.some((s) => source.skills.map((x) => x.toLowerCase()).includes(s.toLowerCase()))).toBe(true);
    const person = db.professionals.find((p) => p.public && p.skills.length > 1)!;
    const people = await mockRecommendationsService.similarPeople(person.id, 4);
    expect(people.map((p) => p.id)).not.toContain(person.id);
    expect(people.every((p) => p.reason === "Has similar skills")).toBe(true);
  });
});
