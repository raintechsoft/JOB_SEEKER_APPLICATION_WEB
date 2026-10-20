import type { Draft } from "immer";
import type { DemoDatabase } from "@/types/domain";
import { ACCOMPLISHMENT_TYPES, profileCompletion, skillKey } from "@/lib/domain/profile";
import { uid } from "@/lib/utils/id";
import { buildProfessionalDetails } from "../data/profile";

/**
 * Brings a stored database up to the current shape. The prototype created several structures
 * lazily (organization workspace, job alerts, structured profile); they are created here once.
 */
export function normalizeDatabase(db: Draft<DemoDatabase>) {
  db.social.reactionDates ??= {};
  db.social.followers ??= ["p1", "p2", "p6"];
  db.social.seenJobs ??= [];
  db.social.comments ??= {};
  db.postEditorDrafts ??= {};
  db.jobEditorDrafts ??= {};
  db.employerRegistrations ??= [];
  db.recruiter.responseOutreach ??= [];

  const p = db.professionals[0];
  if (!Array.isArray(db.social.jobAlerts)) {
    db.social.jobAlerts = [{ id: "alert-my-role", name: p.headline || "My next role", keywords: p.headline || p.skills[0] || "Design", location: "", arrangement: "Any", days: 7, enabled: true }];
  }

  // Structured profile for the signed-in professional (prototype `ensureProfile`).
  p.professionalDetails ??= buildProfessionalDetails(p);
  const d = p.professionalDetails;
  for (const key of Object.keys(ACCOMPLISHMENT_TYPES) as (keyof typeof ACCOMPLISHMENT_TYPES)[]) d[key] ??= [];
  d.skills ??= [];
  d.technicalSkills ??= [];
  d.careerBreaks ??= [];
  d.skills = d.skills.filter((s) => p.skills.some((n) => skillKey(n) === skillKey(s.name)));
  for (const name of p.skills) {
    if (!d.skills.some((s) => skillKey(s.name) === skillKey(name))) d.skills.push({ id: uid(), name, category: "Other", level: "", years: "", featured: true });
  }
  const cfg = db.portfolios[p.id];
  if (!cfg.sections.some((s) => s.name === "Accomplishments")) cfg.sections.push({ name: "Accomplishments", visible: false });
  p.complete = profileCompletion(p, d, db.projects.filter((x) => x.owner === p.id).length).percent;

  for (const a of db.social.applications) {
    a.status ??= "Applied";
    a.trackingNote ??= "";
    a.followUp ??= "";
  }
}
