import type { IconName } from "@/components/ui/icon";
import { apiConfig } from "@/services/api/config";
import type { Role } from "@/types/domain";

export const SETTINGS_SECTIONS = [
  "account",
  "privacy",
  "notifications",
  "personalisation",
  "data",
  "career",
  "organization",
  "hiring",
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number];

export interface SettingsCategory {
  id: SettingsSectionId;
  label: string;
  description?: string;
  icon: IconName;
  roles: Role[];
  httpOnly?: boolean;
  /** Hidden from Settings until the section is ready to show. */
  hidden?: boolean;
}

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: "account",
    label: "Account",
    icon: "user",
    roles: ["professional", "recruiter"],
  },
  {
    id: "privacy",
    label: "Privacy & visibility",
    icon: "eye",
    roles: ["professional", "recruiter"],
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: "bell",
    roles: ["professional", "recruiter"],
    hidden: true,
  },
  {
    id: "personalisation",
    label: "Personalisation",
    icon: "sliders",
    roles: ["professional", "recruiter"],
    httpOnly: true,
  },
  {
    id: "data",
    label: "Data & privacy choices",
    icon: "download",
    roles: ["professional", "recruiter"],
    httpOnly: true,
    hidden: true,
  },
  {
    id: "career",
    label: "Career preferences",
    icon: "briefcase",
    roles: ["professional"],
  },
  {
    id: "organization",
    label: "Organization",
    icon: "building",
    roles: ["recruiter"],
  },
  {
    id: "hiring",
    label: "Hiring",
    icon: "search",
    roles: ["recruiter"],
  },
];

export const SETTINGS_SECTION_SET = new Set<string>(SETTINGS_SECTIONS);

export function isSettingsSectionId(value: string): value is SettingsSectionId {
  return SETTINGS_SECTION_SET.has(value);
}

export function settingsBasePath(role: Role) {
  return role === "recruiter" ? "/recruiter/settings" : "/app/settings";
}

export function settingsCategoriesFor(role: Role, http = apiConfig.dataSource === "http") {
  return SETTINGS_CATEGORIES.filter((category) => category.roles.includes(role) && !category.hidden && (!category.httpOnly || http));
}

export function isHiddenSettingsSection(value: string) {
  return SETTINGS_CATEGORIES.some((category) => category.id === value && category.hidden);
}

export function defaultSettingsSection(role: Role, http = apiConfig.dataSource === "http"): SettingsSectionId {
  const first = settingsCategoriesFor(role, http)[0]?.id;
  if (settingsCategoriesFor(role, http).some((category) => category.id === "privacy")) return "privacy";
  return first ?? "account";
}

export function isSettingsSectionForRole(value: string, role: Role, http = apiConfig.dataSource === "http"): value is SettingsSectionId {
  return settingsCategoriesFor(role, http).some((category) => category.id === value);
}
