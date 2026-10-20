import type { Discipline, Professional } from "@/types/domain";
import { dateAgo } from "@/lib/utils/date";

export const PROFESSIONAL_NAMES = ["Alex Morgan", "Priya Sharma", "Jordan Lee", "Maya Chen", "Sam Rivera", "Aisha Khan", "Theo Bennett", "Elena Rossi", "Noah Williams", "Zara Ahmed", "Leo Park", "Sofia Martinez"];

export const PROFESSIONAL_ROLES = ["Product Designer", "Frontend Engineer", "Data Analyst", "Brand Designer", "Full-stack Developer", "Product Manager", "UX Researcher", "Growth Marketer", "Backend Engineer", "Motion Designer", "Data Scientist", "Content Strategist"];

export const SKILL_SETS = [
  ["Product design", "Figma", "UX research", "Design systems"],
  ["React", "TypeScript", "Accessibility", "CSS"],
  ["SQL", "Python", "Tableau", "Analytics"],
  ["Brand strategy", "Illustration", "Figma", "Typography"],
  ["React", "Node.js", "PostgreSQL", "TypeScript"],
  ["Product strategy", "Research", "Agile", "Analytics"],
  ["User interviews", "Usability testing", "Research", "Figma"],
  ["SEO", "Growth", "Analytics", "Content"],
  ["Python", "APIs", "PostgreSQL", "Docker"],
  ["After Effects", "Animation", "Figma", "Illustration"],
  ["Python", "Machine learning", "SQL", "Statistics"],
  ["Writing", "Content design", "SEO", "Strategy"],
];

const LOCATIONS = ["Bengaluru, India", "Pune, India", "London, UK", "Singapore", "Austin, US", "Mumbai, India"];
const COMPANIES = ["Forma Studio", "Northstar Labs", "Meridian"];
const EDUCATION = ["B.Des, Communication Design · Srishti Institute", "B.Tech, Computer Science · 2019", "BSc, Applied Sciences · 2020"];
export const AVATAR_COLORS = ["#dddaf5", "#dbe8df", "#f0dfd4", "#eadbe9", "#d7e5ed", "#f1e8cc"];

function discipline(role: string): Discipline {
  if (role.includes("Designer") || role.includes("Researcher")) return "Design";
  if (role.includes("Engineer") || role.includes("Developer")) return "Engineering";
  if (role.includes("Data")) return "Data";
  return "Business";
}

export function seedProfessionals(): Professional[] {
  return PROFESSIONAL_NAMES.map((name, i) => {
    const role = PROFESSIONAL_ROLES[i];
    return {
      id: "p" + i,
      slug: name.toLowerCase().replaceAll(" ", "-"),
      name,
      headline: role,
      category: discipline(role),
      location: LOCATIONS[i % 6],
      years: 3 + (i % 7),
      skills: SKILL_SETS[i],
      summary:
        i === 0
          ? "I turn complex problems into thoughtful digital experiences. Currently exploring the intersection of design systems, finance, and everyday life."
          : "I build thoughtful solutions through research, collaboration, and hands-on craft. My work brings ideas to life with clarity and purpose.",
      experience: role + " at " + COMPANIES[i % 3] + " · 2022–Present",
      education: EDUCATION[i % 3],
      interests: "Full-time roles, meaningful collaborations",
      email: name.toLowerCase().replaceAll(" ", ".") + "@example.com",
      website: "https://example.com",
      arrangement: i % 3 ? "Remote" : "Hybrid",
      available: i % 3 !== 2,
      complete: 82 + (i % 4) * 5,
      public: true,
      avatar: i % 6,
      color: AVATAR_COLORS[i % 6],
      lastActive: dateAgo(i % 6),
    };
  });
}

/** Illustrated portraits shipped with the prototype. */
export const PORTRAITS: Record<string, string> = {
  p0: "/images/avatars/alex-morgan.svg",
  p1: "/images/avatars/priya-sharma.svg",
  p3: "/images/avatars/maya-chen.svg",
};
