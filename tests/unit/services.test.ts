import { beforeEach, describe, expect, it } from "vitest";
import { createServices } from "@/services";
import { DEMO_STORAGE_KEY, demoDbStore, getDb } from "@/mocks/store/demo-db";

const services = createServices();

beforeEach(() => {
  localStorage.clear();
  demoDbStore.setState({ db: null });
});

describe("mock feed service", () => {
  it("returns the professional feed with jobs, followed people and own updates", async () => {
    const page = await services.feed.getFeed({ role: "professional", filter: "all", sort: "recent", q: "", limit: 12 });
    expect(page.items).toHaveLength(12);
    expect(page.total).toBeGreaterThan(12);
    expect(page.items.some((i) => i.type === "job")).toBe(true);
    expect(page.suggestions).toHaveLength(3);
    // Items are newest first.
    const dates = page.items.map((i) => i.createdAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("likes, saves and persists to browser storage", async () => {
    expect(await services.feed.toggleLike("professional", "post-maya")).toBe(true);
    expect((await services.feed.toggleSave("professional", "post-maya")).saved).toBe(true);
    const saved = await services.feed.getFeed({ role: "professional", filter: "saved", sort: "recent", q: "", limit: 12 });
    expect(saved.items.map((i) => i.id)).toEqual(["post-maya"]);
    expect(saved.items[0].viewer.liked).toBe(true);
    expect(JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!).social.saved).toEqual(["post-maya"]);
  });

  it("keeps recruiter interactions separate from the professional's", async () => {
    await services.feed.toggleLike("recruiter", "post-maya");
    expect(getDb().social.liked).toEqual([]);
    expect(getDb().recruiterSocial.liked).toEqual(["post-maya"]);
  });

  it("searches across titles, bodies and authors", async () => {
    const page = await services.feed.getFeed({ role: "professional", filter: "all", sort: "recent", q: "sunday studio", limit: 50 });
    expect(page.items.map((i) => i.id)).toContain("post-maya");
    expect(page.items.every((i) => [i.title, i.body, i.author?.name].join(" ").toLowerCase().includes("sunday studio") || i.type === "job")).toBe(true);
  });
});

describe("mock jobs and applications", () => {
  it("applies once and tracks the application", async () => {
    await services.jobs.apply({ jobId: "job-design", name: "Alex", email: "alex.morgan@example.com", note: "", portfolio: true, recruitmentDetails: {}, answers: {} });
    await services.jobs.apply({ jobId: "job-design", name: "Alex", email: "alex.morgan@example.com", note: "", portfolio: true, recruitmentDetails: {}, answers: {} });
    const list = await services.applications.listApplications({ q: "", status: "" });
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("Applied");
    // The recruiter sees it in the inbox alongside the three samples.
    const responses = await services.recruiting.listResponses({});
    expect(responses.total).toBe(4);
  });

  it("filters the response centre by stage and keyword match", async () => {
    await services.recruiting.setStatus(["received-maya"], "Shortlisted");
    const shortlisted = await services.recruiting.listResponses({ stage: "Shortlisted" });
    expect(shortlisted.items.map((i) => i.application.id)).toEqual(["received-maya"]);
    const result = await services.recruiting.runKeywordMatch({ fit: "1", fitTerms: "Figma", threshold: "100" }, true);
    expect(result.matches).toBeGreaterThan(0);
  });

  it("exports CSV with formula injection protection", async () => {
    await services.recruiting.saveNote("received-alex", "=HYPERLINK(1)");
    const csv = await services.recruiting.exportCsv(["received-alex"]);
    expect(csv.split("\r\n")[0]).toContain('"Name","Email"');
    expect(csv).toContain(`"'=HYPERLINK(1)"`);
  });
});

describe("mock registration (demo OTP)", () => {
  it("requires both verified channels before creating the employer", async () => {
    const input = { country: "+91", mobile: "9876543210", accountType: "company" as const, fullName: "Riya Rao", email: "riya@acme.example", hiringFor: "company" as const, companyName: "Acme Works", industry: "Manufacturing", employees: "11–50 employees", designation: "Founder", pincode: "560001", address: "1 Main Road, Bengaluru" };
    expect((await services.registration.registerEmployer(input)).ok).toBe(false);
    const sms = await services.registration.requestOtp("sms", "+919876543210");
    expect((await services.registration.verifyOtp(sms.id, "+919876543210", "000000")).ok).toBe(false);
    expect((await services.registration.verifyOtp(sms.id, "+919876543210", sms.demoCode!)).ok).toBe(true);
    const email = await services.registration.requestOtp("email", "riya@acme.example");
    await services.registration.verifyOtp(email.id, "riya@acme.example", email.demoCode!);
    expect((await services.registration.registerEmployer(input)).ok).toBe(true);
    expect(getDb().companies[0].name).toBe("Acme Works");
    expect(getDb().organizationWorkspace.organization.slug).toBe("acme-works");
    expect(getDb().session).toEqual({ role: "recruiter" });
  });
});

describe("mock talent and portfolio", () => {
  it("filters talent and keeps private data out of public profiles", async () => {
    const designers = await services.talent.search({ q: "", category: "Design", skill: "", location: "", years: "", availability: "", completeness: false, recent: false, sort: "relevance" });
    expect(designers.every((p) => p.category === "Design")).toBe(true);
    const view = await services.portfolio.getPortfolio("p0");
    expect(view?.person).not.toHaveProperty("professionalDetails");
    expect(view?.person.credentials.contact).toEqual({ email: undefined, phone: undefined });
  });

  it("rejects a portfolio slug owned by someone else", async () => {
    const result = await services.portfolio.saveSettings({ title: "Alex", headline: "Designer", slug: "maya-chen", theme: "#5146e5", public: true });
    expect(result.ok).toBe(false);
  });
});
