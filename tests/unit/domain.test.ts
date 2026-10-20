import { describe, expect, it } from "vitest";
import type { Job, JobAlert } from "@/types/domain";
import { formatSalary, jobStatus, matchesAlert, normalizeKeywords } from "@/lib/domain/jobs";
import { draftJobFromBrief } from "@/lib/domain/job-draft-generator";
import { errorSection, organizationCompletion, validateOrganization } from "@/lib/domain/organization";
import { profileCompletion } from "@/lib/domain/profile";
import { createSeed } from "@/mocks/seed";
import { daysValue, distance, moneyValue, splitTerms } from "@/services/recruiting/response-matching";
import { parseSkills } from "@/lib/utils/text";
import { safeUrl, safeVideoUrl } from "@/lib/utils/url";

const job = (patch: Partial<Job> = {}): Job => ({ ...createSeed().social.jobs[0], ...patch });
const alert = (patch: Partial<JobAlert> = {}): JobAlert => ({ id: "a", name: "Design", keywords: "Product designers", location: "", arrangement: "Any", days: 7, enabled: true, ...patch });

describe("job alerts", () => {
  it("normalises plural role words", () => {
    expect(normalizeKeywords("Product Designers & Developers!")).toBe("product design develop");
  });
  it("matches all keywords, location, arrangement and recency", () => {
    expect(matchesAlert(job(), alert())).toBe(true);
    expect(matchesAlert(job(), alert({ keywords: "Product Designer React" }))).toBe(false);
    expect(matchesAlert(job(), alert({ location: "Mumbai" }))).toBe(false);
    expect(matchesAlert(job(), alert({ arrangement: "Remote" }))).toBe(false);
    expect(matchesAlert(job({ createdAt: new Date(Date.now() - 10 * 864e5).toISOString() }), alert())).toBe(false);
  });
  it("ignores paused alerts and closed or draft jobs", () => {
    expect(matchesAlert(job(), alert({ enabled: false }))).toBe(false);
    expect(matchesAlert(job({ closed: true }), alert())).toBe(false);
    expect(matchesAlert(job({ draft: true }), alert())).toBe(false);
  });
});

describe("jobs", () => {
  it("derives status", () => {
    expect(jobStatus(job())).toBe("Active");
    expect(jobStatus(job({ draft: true }))).toBe("Draft");
    expect(jobStatus(job({ closed: true }))).toBe("Closed");
    expect(jobStatus(job({ expiresAt: "2000-01-01" }))).toBe("Expired");
  });
  it("formats salary ranges", () => {
    expect(formatSalary({ hideSalary: false, currency: "INR", salaryMin: "18", salaryMax: "26", variableEnabled: true, variablePercent: "10" })).toBe("₹18–26 LPA + 10% variable");
    expect(formatSalary({ hideSalary: false, currency: "USD", salaryMin: "90", salaryMax: "120", variableEnabled: false, variablePercent: "" })).toBe("$90–120 per year");
    expect(formatSalary({ hideSalary: true, currency: "INR", salaryMin: "1", salaryMax: "2", variableEnabled: false, variablePercent: "" })).toBe("Salary not disclosed");
  });
  it("generates a template draft that keeps the brief's limits", () => {
    const draft = draftJobFromBrief({ role: "Frontend Engineer", experienceMin: "2", experienceMax: "5", salaryMin: "10", salaryMax: "20", currency: "INR", location: "Pune; Remote", arrangement: "Hybrid", employment: "Full-time", skills: "", hideSalary: false });
    expect(draft.department).toBe("Engineering");
    expect(draft.locations).toEqual(["Pune", "Remote"]);
    expect(draft.experienceMin).toBe("2");
    expect(draft.description).toContain("₹10–20 LPA");
    expect(draft.questions).toHaveLength(2);
  });
});

describe("organization", () => {
  const org = () => structuredClone(createSeed().organizationWorkspace.organization);
  it("validates required fields, slug, URLs and email", () => {
    const o = { ...org(), name: "", slug: "Bad Slug", websiteUrl: "ftp://x", publicContactEmail: "nope" };
    const e = validateOrganization(o);
    expect(Object.keys(e)).toEqual(expect.arrayContaining(["name", "slug", "websiteUrl", "publicContactEmail"]));
    expect(errorSection(e)).toBe("contact");
    expect(validateOrganization(org())).toEqual({});
  });
  it("computes completion", () => {
    expect(organizationCompletion(org()).percent).toBe(88);
  });
});

describe("profile completion", () => {
  it("weights nine essentials", () => {
    const db = createSeed();
    const p = db.professionals[0];
    expect(profileCompletion(p, undefined, 2).percent).toBe(100);
    expect(profileCompletion({ ...p, summary: "", website: "" }, undefined, 0).percent).toBe(65);
  });
});

describe("response matching helpers", () => {
  it("parses notice periods and salaries", () => {
    expect(daysValue("Immediate")).toBe(0);
    expect(daysValue("2 months")).toBe(60);
    expect(daysValue("3 weeks")).toBe(21);
    expect(daysValue("")).toBeNull();
    expect(moneyValue("18.5")).toBe(18.5);
    expect(moneyValue("1800000")).toBe(18);
    expect(moneyValue("")).toBeNull();
  });
  it("splits terms by comma or whitespace", () => {
    expect(splitTerms("React, Type Script")).toEqual(["React", "Type Script"]);
    expect(splitTerms("React TypeScript React")).toEqual(["React", "TypeScript"]);
  });
  it("estimates distance between known cities", () => {
    const d = distance({ location: "Mumbai, India" }, job({ location: "Bengaluru, India" }));
    expect(d?.estimated).toBe(true);
    expect(d!.km).toBeGreaterThan(800);
    expect(d!.km).toBeLessThan(900);
    expect(distance({ location: "Nowhere" }, job())).toBeNull();
  });
});

describe("utilities", () => {
  it("parses skills", () => expect(parseSkills(" Figma, figma ,UX, , UX")).toEqual(["Figma", "figma", "UX"]));
  it("accepts only http(s) URLs", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("https://example.com")).toBe("https://example.com/");
    expect(safeVideoUrl("https://example.com/a.mp4")).toBe("https://example.com/a.mp4");
    expect(safeVideoUrl("https://example.com/a.mov")).toBe("");
  });
});
