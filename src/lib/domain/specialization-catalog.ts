/**
 * Occupational specializations for the resume-headline "Specialization / focus" field.
 * These are practice areas, not tools or soft skills — those belong in Key skills.
 * Users can still add a specialization that is not listed.
 */
export interface SpecializationArea {
  area: string;
  specializations: string[];
}

export const SPECIALIZATION_AREAS: SpecializationArea[] = [
  { area: "Software development", specializations: ["Frontend engineering", "Backend engineering", "Full-stack engineering", "Platform engineering", "QA / test engineering", "Software architecture"] },
  { area: "Mobile development", specializations: ["Android development", "iOS development", "Cross-platform mobile development"] },
  { area: "Cloud & DevOps", specializations: ["DevOps", "Site reliability engineering", "Cloud engineering", "Infrastructure engineering"] },
  { area: "Data & AI", specializations: ["Data analysis", "Data engineering", "Data science", "Machine learning", "Business intelligence", "Generative AI"] },
  { area: "Cybersecurity", specializations: ["Security engineering", "Security operations", "Governance, risk and compliance", "Penetration testing"] },
  { area: "IT support & systems", specializations: ["IT support", "Systems administration", "Enterprise applications"] },
  { area: "Design & creative", specializations: ["Product design", "UX research", "UI design", "Visual / brand design", "Content design", "Motion design"] },
  { area: "Product & project management", specializations: ["Product management", "Project management", "Program management", "Business analysis", "Agile coaching"] },
  { area: "Marketing", specializations: ["Digital marketing", "Content marketing", "Brand marketing", "Growth marketing", "Product marketing", "SEO / SEM"] },
  { area: "Sales & business development", specializations: ["B2B sales", "Account management", "Business development", "Customer success", "Pre-sales"] },
  { area: "Finance & accounting", specializations: ["Accounting", "Financial analysis", "Audit", "Taxation", "Corporate finance", "Treasury"] },
  { area: "Human resources", specializations: ["Talent acquisition", "HR operations", "Learning and development", "Compensation and benefits", "HR business partner"] },
  { area: "Operations & supply chain", specializations: ["Operations management", "Supply chain", "Procurement", "Logistics", "Quality management"] },
  { area: "Engineering", specializations: ["Mechanical engineering", "Electrical engineering", "Civil / structural engineering", "Chemical / process engineering", "Industrial engineering", "Electronics / embedded engineering"] },
  { area: "Construction & trades", specializations: ["Construction management", "Quantity surveying", "Skilled trades"] },
  { area: "Healthcare & life sciences", specializations: ["Clinical care / nursing", "Clinical research", "Pharmacy", "Public health", "Medical devices", "Biotechnology"] },
  { area: "Education & training", specializations: ["Teaching", "Instructional design", "Corporate training", "Academic research"] },
  { area: "Legal & compliance", specializations: ["Corporate law", "Litigation", "Compliance", "Contracts", "Data privacy"] },
  { area: "Hospitality, retail & travel", specializations: ["Hospitality operations", "Culinary arts", "Retail operations", "Travel operations", "Event management"] },
  { area: "Media, content & communication", specializations: ["Content writing / journalism", "Corporate communications", "Video production", "Social media"] },
  { area: "Customer support", specializations: ["Customer support", "Customer experience"] },
  { area: "Leadership & management", specializations: ["People management", "General management", "Operations leadership", "Executive leadership"] },
  { area: "Agriculture & environment", specializations: ["Agriculture / agronomy", "Environmental management", "Sustainability", "Food processing"] },
];

export interface CatalogSpecialization {
  name: string;
  area: string;
}

export const SPECIALIZATION_CATALOG: CatalogSpecialization[] = (() => {
  const seen = new Set<string>();
  const list: CatalogSpecialization[] = [];
  for (const { area, specializations } of SPECIALIZATION_AREAS) {
    for (const name of specializations) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ name, area });
    }
  }
  return list;
})();

/** Ranked search: names starting with the query first, then word starts, then any match. */
export function searchSpecializations(query: string, limit = 80): CatalogSpecialization[] {
  const q = query.trim().toLowerCase();
  if (!q) return SPECIALIZATION_CATALOG.slice(0, limit);
  const scored: [number, CatalogSpecialization][] = [];
  for (const item of SPECIALIZATION_CATALOG) {
    const name = item.name.toLowerCase();
    const rank = name === q ? 0 : name.startsWith(q) ? 1 : name.split(/[\s/().-]+/).some((word) => word.startsWith(q)) ? 2 : name.includes(q) ? 3 : item.area.toLowerCase().includes(q) ? 4 : -1;
    if (rank >= 0) scored.push([rank, item]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name)).slice(0, limit).map(([, item]) => item);
}

export function catalogSpecialization(name: string): CatalogSpecialization | undefined {
  const key = name.trim().toLowerCase();
  return SPECIALIZATION_CATALOG.find((item) => item.name.toLowerCase() === key);
}
