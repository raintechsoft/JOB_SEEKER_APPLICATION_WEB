import type { Professional, Project, WorkUpdate } from "@/types/domain";
import { dateAgo } from "@/lib/utils/date";
import { SKILL_SETS } from "./professionals";

const PROJECT_TITLES = ["Forma — Making finance feel human", "A calmer way to plan your day", "Open-source component library", "Retail insights, made visible", "A new identity for Sunday Studio", "Building a community for makers", "The research behind better onboarding", "An experiment-led growth playbook", "Reliable APIs for modern commerce", "Small moments. Meaningful motion.", "Forecasting a more sustainable future", "A voice that brings people together", "Orbit — A workspace in harmony", "Reimagining the checkout experience", "From complex data to clear decisions"];

const PROJECT_DESCRIPTIONS = [
  "A thoughtful banking experience that helps people feel in control of their money. From discovery to a complete, accessible design system.",
  "A focused workspace designed around the way people actually think. Research, strategy, and thoughtful details in one place.",
  "An exploration in clarity: translating complex ideas into approachable, useful experiences.",
];

const ownerIndex = (i: number) => (i < 2 ? 0 : i < 12 ? i - 1 : i - 12);

export function seedProjects(professionals: Professional[]): Project[] {
  return PROJECT_TITLES.map((title, i) => {
    const owner = professionals[ownerIndex(i)];
    return {
      id: "proj" + i,
      owner: owner.id,
      title,
      description: PROJECT_DESCRIPTIONS[i % 3],
      category: owner.category,
      skills: owner.skills.slice(0, 3),
      contribution: "Led discovery, explored concepts, and collaborated with the team to bring the experience to life.",
      url: "https://example.com",
      repository: "",
      start: "2026-07-01",
      date: dateAgo(i * 3),
      visibility: "Public",
      featured: i !== 1,
      art: i % 5,
      cover: "",
    };
  });
}

const UPDATE_TITLES = ["Shipped the new transaction experience", "Exploring a more accessible color system", "Turning research into product decisions", "A small detail with a big impact", "Wrapped up a round of usability testing", "Documenting our component foundations", "Learning through a new side project", "A collaborative design review"];

const UPDATE_DESCRIPTIONS = [
  "Refined the transaction flow after testing with five participants. Simplified the key actions and improved keyboard navigation across the experience.",
  "Spent time exploring, making, and sharing. Captured the key decisions and what I learned along the way.",
];

export function seedUpdates(): WorkUpdate[] {
  return Array.from({ length: 56 }, (_, i) => ({
    id: "u" + i,
    owner: i < 32 ? "p0" : "p" + (1 + (i % 11)),
    title: UPDATE_TITLES[i % 8],
    description: UPDATE_DESCRIPTIONS[i % 2],
    category: ["Design", "Research", "Learning", "Development"][i % 4],
    skills: SKILL_SETS[i < 32 ? 0 : 1 + (i % 11)].slice(0, 2),
    project: "proj" + (i % 2),
    date: dateAgo(i < 32 ? Math.floor(i * 2.7) : i),
    visibility: i === 4 ? "Private" : "Public",
  }));
}
