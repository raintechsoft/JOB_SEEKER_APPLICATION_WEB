/**
 * Local keyword matching and filtering for the recruiter response centre.
 *
 * This is the prototype's transparent rule-based matcher ("AI filter · Keyword matching demo"),
 * not a model. A real deployment moves candidate search and ranking to the backend.
 */
import type { DemoDatabase, Job, ReceivedApplication } from "@/types/domain";
import { person } from "@/mocks/store/selectors";
import type { ApplicantProfile, ResponseParams, ResponseTab } from "./recruiting.service";

export const normalizeText = (v: unknown) =>
  String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim();

export const splitTerms = (v: string | undefined) =>
  [...new Set((String(v || "").includes(",") ? String(v).split(",") : String(v || "").split(/\s+/)).map((s) => s.trim()).filter(Boolean))].slice(0, 30);

const includes = (text: string, q: string | undefined) => !q || normalizeText(text).includes(normalizeText(q));

export function daysValue(v: unknown): number | null {
  if (v === 0 || String(v).trim() === "0" || /immediate|available now/i.test(String(v))) return 0;
  const m = String(v || "").match(/(\d+)\s*(day|week|month)?/i);
  return m ? Number(m[1]) * (m[2]?.toLowerCase() === "month" ? 30 : m[2]?.toLowerCase() === "week" ? 7 : 1) : null;
}

export function moneyValue(v: unknown): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? (n >= 1e5 ? n / 1e5 : n) : null;
}

const CITIES: [string, number, number][] = [
  ["bengaluru", 12.9716, 77.5946],
  ["bangalore", 12.9716, 77.5946],
  ["mumbai", 19.076, 72.8777],
  ["pune", 18.5204, 73.8567],
  ["london", 51.5074, -0.1278],
  ["singapore", 1.3521, 103.8198],
  ["austin", 30.2672, -97.7431],
];

function coordinates(value: string) {
  const city = CITIES.find(([name]) => normalizeText(value).includes(name));
  return city ? { lat: city[1], lng: city[2], estimated: true } : null;
}

/** Great-circle distance using city-centre estimates when precise coordinates are unavailable. */
export function distance(profile: Pick<ApplicantProfile, "location">, job: Job | undefined) {
  if (!job) return null;
  const a = coordinates(profile.location);
  const b = coordinates(job.location);
  if (!a || !b) return null;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dlat = rad(b.lat - a.lat);
  const dlng = rad(b.lng - a.lng);
  const v = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2;
  return { km: Math.round(6371 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v))), estimated: a.estimated || b.estimated };
}

export interface ApplicantWithText extends ApplicantProfile {
  text: string;
}

export function applicantProfile(db: DemoDatabase, a: ReceivedApplication): ApplicantWithText {
  const p = person(db, a.candidate);
  const d = p.professionalDetails;
  const r = { ...(a.recruitmentDetails || {}) };
  const employment = (d?.employment || []).filter((e) => e.public !== false);
  const education = (d?.education || []).filter((e) => e.public !== false);
  const publicProjects = db.projects.filter((j) => j.owner === p.id && j.visibility === "Public");
  const current = employment.find((e) => e.current);
  const previous = employment.find((e) => !e.current);
  const educationText = education.length ? education.map((e) => [e.degree, e.field, e.institution, e.end].filter(Boolean).join(" · ")).join("\n") : p.education || "";
  const notice = daysValue(r.noticeDays);
  const joining = daysValue(r.joiningDays) ?? notice;
  return {
    id: p.id,
    name: a.name || p.name,
    picture: p.picture,
    color: p.color,
    slug: p.slug,
    headline: p.headline,
    summary: p.summary,
    skills: p.skills,
    email: a.email || p.email,
    location: r.location || p.location,
    locality: r.locality || p.locality || "",
    years: Number(p.years),
    expectedSalary: moneyValue(r.expectedSalaryLpa),
    notice,
    joining,
    industry: r.industry || p.industry || "",
    designation: r.designation || (current ? String(current.title ?? "") : "") || d?.currentTitle || p.headline,
    department: r.department || p.department || p.category || "",
    educationText,
    currentRole: current ? [current.title, current.company].filter(Boolean).join(" at ") : p.experience || p.headline,
    previousRole: previous ? [previous.title, previous.company].filter(Boolean).join(" at ") : "",
    preferredLocations: r.preferredLocations || p.location,
    phone: r.phone || "",
    text: [
      p.name,
      p.headline,
      p.summary,
      p.experience,
      educationText,
      ...(p.skills || []),
      ...employment.map((e) => [e.title, e.company, e.description, e.skills].join(" ")),
      ...publicProjects.map((j) => [j.title, j.description, ...j.skills].join(" ")),
      a.resumeText || "",
      a.note || "",
      ...(a.screeningAnswers || []).map((x) => x.answer),
    ].join(" "),
  };
}

export function matchScore(job: Job | undefined, p: ApplicantWithText, params: ResponseParams) {
  const terms = params.fitTerms ? splitTerms(params.fitTerms) : job?.skills || [];
  const matched = terms.filter((t) => (" " + normalizeText(p.text) + " ").includes(" " + normalizeText(t) + " "));
  return { terms, matched, score: terms.length ? Math.round((matched.length / terms.length) * 100) : 0 };
}

export const stageMatch = (a: ReceivedApplication, stage: ResponseTab) =>
  stage === "all" || (stage === "unviewed" ? !a.viewedAt : stage === "pending" ? ["New", "Reviewing"].includes(a.status) : a.status === stage);

const DEGREES: Record<string, RegExp> = {
  bachelor: /bachelor|b\.?\s?(tech|sc|des|com|a\b|e\b)|graduate/i,
  master: /master|m\.?\s?(tech|sc|des|com|a\b|ba|e\b)/i,
  diploma: /diploma/i,
  doctorate: /doctor|ph\.?d/i,
  school: /class|school|secondary|higher secondary/i,
};

const degreeMatch = (text: string, degree: string | undefined) => !degree || DEGREES[degree]?.test(text) || false;

/** Advanced filters. Active filters exclude records with missing details, as in the prototype. */
export function passesFilters(job: Job | undefined, p: ApplicantWithText, q: ResponseParams) {
  const keywords = splitTerms(q.keywords);
  const found = keywords.filter((t) => (" " + normalizeText(p.text) + " ").includes(" " + normalizeText(t) + " "));
  if (keywords.length && (q.keywordMode === "all" ? found.length !== keywords.length : !found.length)) return false;
  if (!includes(p.location, q.location) || !includes(p.locality, q.locality) || !includes(p.industry, q.industry) || !includes(p.designation, q.designation) || !includes(p.department, q.department)) return false;
  if (q.expMin && p.years < Number(q.expMin)) return false;
  if (q.expMax && p.years > Number(q.expMax)) return false;
  if (q.salaryMin && (p.expectedSalary == null || p.expectedSalary < Number(q.salaryMin))) return false;
  if (q.salaryMax && (p.expectedSalary == null || p.expectedSalary > Number(q.salaryMax))) return false;
  if (!degreeMatch(p.educationText, q.education)) return false;
  for (const [key, value] of [
    ["notice", p.notice],
    ["joining", p.joining],
  ] as const) {
    const filter = q[key];
    if (filter && (value == null || (filter === "90+" ? value <= 90 : value > Number(filter)))) return false;
  }
  if (q.distance) {
    if (!q.job) return false;
    const d = distance(p, job);
    if (!d || d.km > Number(q.distance)) return false;
  }
  if (q.fit === "1" && matchScore(job, p, q).score < Number(q.threshold || 60)) return false;
  return true;
}
