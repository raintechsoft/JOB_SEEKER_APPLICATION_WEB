/**
 * Preference-section catalogs. Closed lists (gender, marital status, work authorization, notice,
 * employment type, arrangement, currency) stay short enough for a native select. Longer occupational
 * lists use the same searchable picker as key skills. Stored values are the option labels.
 */
import { PHONE_COUNTRIES } from "@/lib/validation/auth";
import { SPECIALIZATION_AREAS } from "./specialization-catalog";

export type CatalogEntry = { name: string; group: string };

function unique(items: CatalogEntry[]): CatalogEntry[] {
  const seen = new Set<string>();
  const list: CatalogEntry[] = [];
  for (const item of items) {
    const key = item.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(item);
  }
  return list;
}

function grouped(groups: { group: string; names: string[] }[]): CatalogEntry[] {
  return unique(groups.flatMap(({ group, names }) => names.map((name) => ({ name, group }))));
}

function searchList(list: CatalogEntry[], query: string, limit: number): CatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return list.slice(0, limit);
  const scored: [number, CatalogEntry][] = [];
  for (const item of list) {
    const name = item.name.toLowerCase();
    const rank =
      name === q ? 0
      : name.startsWith(q) ? 1
      : name.split(/[\s/().&,+-]+/).some((word) => word.startsWith(q)) ? 2
      : name.includes(q) ? 3
      : item.group.toLowerCase().includes(q) ? 4
      : -1;
    if (rank >= 0) scored.push([rank, item]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name)).slice(0, limit).map(([, item]) => item);
}

/** LinkedIn/Naukri-style caps that still sit under the listtext maximum of 30. */
export const PREFERENCE_LIMITS = {
  roles: 8,
  industries: 10,
  departments: 8,
  types: 5,
  locations: 10,
  interests: 12,
  benefits: 12,
} as const;

export const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"] as const;
export const MARITAL_STATUSES = ["Married", "Single", "Prefer not to say"] as const;
export const WORK_PERMITS = [
  "Citizen",
  "Permanent resident",
  "Authorized to work without sponsorship",
  "Authorized to work in India",
  "Requires visa / sponsorship",
  "Student or limited authorization",
  "Prefer not to say",
] as const;
export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Freelance", "Internship", "Temporary", "Other"] as const;
export const WORK_ARRANGEMENTS = ["On-site", "Hybrid", "Remote", "Flexible"] as const;
export const NOTICE_PERIODS = ["Immediate", "15 days", "30 days", "45 days", "60 days", "90 days", "Serving notice period", "More than 90 days"] as const;
export const CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;
export const CONTACT_METHODS = ["Email", "Phone", "Messages"] as const;

export const INDUSTRY_CATALOG = grouped([
  { group: "Technology", names: ["Information Technology", "Software", "SaaS", "Internet", "HR Tech", "EdTech", "HealthTech", "Fintech", "Gaming", "Semiconductors", "Electronics", "Telecommunications"] },
  { group: "Business services", names: ["Professional Services", "Consulting", "Human Resources", "Recruitment", "Legal", "Marketing & Advertising", "Design", "Media & Entertainment"] },
  { group: "Finance", names: ["Finance & Banking", "Insurance", "Investment management", "Accounting"] },
  { group: "Industry", names: ["Manufacturing", "Automotive", "Aerospace & Defence", "Chemicals", "Textiles", "Mining", "Oil & Gas", "Energy", "Utilities", "Construction", "Real Estate"] },
  { group: "Consumer", names: ["Retail", "Retail & eCommerce", "E-commerce", "FMCG", "Food & Beverage", "Hospitality", "Travel & Tourism", "Sports"] },
  { group: "Public & care", names: ["Healthcare", "Pharmaceuticals", "Biotechnology", "Education", "Government", "Non-profit", "Agriculture"] },
  { group: "Operations", names: ["Logistics", "Transportation", "Supply chain"] },
  { group: "Other", names: ["Other"] },
]);

export const DEPARTMENT_CATALOG = grouped([
  { group: "Product & technology", names: ["Engineering", "Product", "Design", "Data & analytics", "IT", "Security", "Quality assurance", "Research & development"] },
  { group: "Go to market", names: ["Sales & retail", "Sales", "Marketing", "Customer success", "Customer support", "Business development"] },
  { group: "Corporate", names: ["Operations", "Human resources", "Finance", "Legal", "Compliance", "Administration", "Procurement", "Supply chain"] },
  { group: "Specialist", names: ["Consulting", "Healthcare", "Clinical", "Education"] },
  { group: "Other", names: ["Other"] },
]);

export const ROLE_CATEGORY_CATALOG = grouped([
  { group: "Technology", names: ["Engineering", "Software engineering", "Data & AI", "IT support & systems", "Cybersecurity"] },
  { group: "Product & design", names: ["Product management", "Design", "Research"] },
  { group: "Business", names: ["Sales", "Marketing", "Finance", "Human resources", "Operations", "Consulting", "Customer support", "Legal"] },
  { group: "Practice", names: ["Healthcare", "Education", "Skilled trades", "Leadership / general management"] },
  { group: "Other", names: ["Other"] },
]);

const ROLE_TITLES = grouped([
  { group: "Software", names: ["Software Engineer", "Senior Software Engineer", "Staff Engineer", "Principal Engineer", "Engineering Lead", "Engineering Manager", "Tech Lead", "Frontend Engineer", "Backend Engineer", "Full-stack Engineer", "Platform Engineer", "DevOps Engineer", "SRE", "QA Engineer", "Mobile Engineer", "Android Developer", "iOS Developer"] },
  { group: "Data & AI", names: ["Data Analyst", "Data Engineer", "Data Scientist", "Machine Learning Engineer", "Business Analyst", "Analytics Engineer"] },
  { group: "Product & design", names: ["Product Manager", "Senior Product Manager", "Product Designer", "UX Designer", "UI Designer", "UX Researcher"] },
  { group: "Go to market", names: ["Account Executive", "Account Manager", "Sales Manager", "Customer Success Manager", "Marketing Manager", "Content Writer", "Recruiter", "Talent Acquisition Specialist"] },
  { group: "Corporate", names: ["Project Manager", "Program Manager", "Operations Manager", "Financial Analyst", "Accountant", "HR Manager", "Support Engineer", "Solutions Architect", "Consultant"] },
  { group: "Practice", names: ["Nurse", "Teacher", "Pharmacist", "Civil Engineer", "Mechanical Engineer", "Electrical Engineer", "Graphic Designer"] },
]);

export const ROLE_CATALOG = unique([
  ...SPECIALIZATION_AREAS.flatMap(({ area, specializations }) => specializations.map((name) => ({ name, group: area }))),
  ...ROLE_TITLES,
]);

export const LOCATION_CATALOG = grouped([
  { group: "Work mode", names: ["Remote", "Hybrid"] },
  { group: "India", names: ["Bengaluru", "Hyderabad", "Pune", "Mumbai", "Delhi", "Noida", "Gurugram", "Chennai", "Kolkata", "Ahmedabad", "Jaipur", "Kochi", "Chandigarh", "Coimbatore", "Indore", "Lucknow", "Thiruvananthapuram", "Visakhapatnam"] },
  { group: "International", names: ["London", "New York", "San Francisco", "Seattle", "Austin", "Toronto", "Singapore", "Dubai", "Berlin", "Amsterdam", "Dublin", "Sydney", "Tokyo"] },
]);

export const INTEREST_CATALOG = unique(
  SPECIALIZATION_AREAS.flatMap(({ area, specializations }) => specializations.map((name) => ({ name, group: area }))),
);

export const COUNTRY_CATALOG: CatalogEntry[] = PHONE_COUNTRIES.map((country) => ({ name: country.name, group: "Countries" }));
export const NATIONALITY_CATALOG: CatalogEntry[] = unique([
  { name: "Prefer not to say", group: "Privacy" },
  ...COUNTRY_CATALOG,
]);

export const EMPLOYMENT_TYPE_CATALOG: CatalogEntry[] = EMPLOYMENT_TYPES.map((name) => ({ name, group: "Employment type" }));

export const BENEFIT_CATALOG = grouped([
  { group: "Health & wellbeing", names: ["Health insurance", "Dental insurance", "Vision insurance", "Mental health support", "Wellness stipend", "Gym membership"] },
  { group: "Time & leave", names: ["Flexible working hours", "Flexible PTO", "Paid time off", "Parental leave", "Sabbatical", "Volunteer days"] },
  { group: "Money & equity", names: ["Competitive salary", "Performance bonus", "Equity / stock options", "Retirement contribution", "Commuter benefits"] },
  { group: "Work setup", names: ["Remote work", "Hybrid work", "Home-office stipend", "Company laptop", "Internet stipend"] },
  { group: "Growth", names: ["Learning budget", "Conference budget", "Mentorship", "Career development", "Internal mobility"] },
  { group: "Culture", names: ["Annual retreat", "Team events", "Meals / snacks", "Childcare support", "Relocation assistance"] },
]);

export type PreferenceCatalogId =
  | "industry"
  | "department"
  | "roleCategory"
  | "role"
  | "location"
  | "interest"
  | "country"
  | "nationality"
  | "employmentType"
  | "benefit";

const CATALOGS: Record<PreferenceCatalogId, CatalogEntry[]> = {
  industry: INDUSTRY_CATALOG,
  department: DEPARTMENT_CATALOG,
  roleCategory: ROLE_CATEGORY_CATALOG,
  role: ROLE_CATALOG,
  location: LOCATION_CATALOG,
  interest: INTEREST_CATALOG,
  country: COUNTRY_CATALOG,
  nationality: NATIONALITY_CATALOG,
  employmentType: EMPLOYMENT_TYPE_CATALOG,
  benefit: BENEFIT_CATALOG,
};

export const PREFERENCE_CATALOG_META: Record<PreferenceCatalogId, { noun: string; placeholder: string; emptyHint: string }> = {
  industry: { noun: "industry", placeholder: "Search industries, e.g. Software, Healthcare", emptyHint: "Type an industry to add it." },
  department: { noun: "department", placeholder: "Search departments, e.g. Engineering, Marketing", emptyHint: "Type a department to add it." },
  roleCategory: { noun: "role category", placeholder: "Search categories, e.g. Software engineering", emptyHint: "Type a role category to add it." },
  role: { noun: "role", placeholder: "Search roles, e.g. Senior Software Engineer", emptyHint: "Type a role to add it." },
  location: { noun: "location", placeholder: "Search locations, e.g. Bengaluru, Remote", emptyHint: "Type a location to add it." },
  interest: { noun: "interest", placeholder: "Search interests, e.g. Platform engineering", emptyHint: "Type an interest to add it." },
  country: { noun: "country", placeholder: "Search countries, e.g. India", emptyHint: "Choose a listed country." },
  nationality: { noun: "nationality", placeholder: "Search countries, e.g. India", emptyHint: "Type a nationality to add it." },
  employmentType: { noun: "employment type", placeholder: "Search types, e.g. Full-time", emptyHint: "Choose a listed employment type." },
  benefit: { noun: "benefit", placeholder: "Search benefits, e.g. Health insurance, Learning budget", emptyHint: "Type a benefit to add it." },
};

export function searchPreferenceCatalog(id: PreferenceCatalogId, query: string, limit = 60): CatalogEntry[] {
  return searchList(CATALOGS[id], query, limit);
}

export function knownPreference(id: PreferenceCatalogId, value: string): CatalogEntry | undefined {
  const key = value.trim().toLowerCase();
  return CATALOGS[id].find((item) => item.name.toLowerCase() === key);
}
