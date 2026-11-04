"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { IconName } from "@/components/ui/icon";
import { journeyEnabled } from "@/services/journey/journey.service";

export interface ProfileEditorSection {
  id: string;
  label: string;
  icon: IconName;
  group: string;
  /** Always listed in the sidebar. Optional sections appear after Add Section. */
  core?: boolean;
  description: string;
}

const ESSENTIALS = "Profile essentials";
const EXPERIENCE = "Experience & work";
const CREDENTIALS = "Credentials & proof";
const PREFERENCES = "Preferences & details";

/** Every profile editor the product supports, grouped for the sidebar and Add Section. */
export const PROFILE_SECTION_CATALOG: ProfileEditorSection[] = [
  { id: "resume", label: "Resume", icon: "file", group: ESSENTIALS, core: true, description: "Your CV for applications. This document stays private." },
  { id: "headline", label: "Resume headline", icon: "edit", group: ESSENTIALS, core: true, description: "A short professional headline and specialization." },
  { id: "summary", label: "Profile summary", icon: "message", group: ESSENTIALS, core: true, description: "A short story of your background and what you care about." },
  { id: "skills", label: "Key skills", icon: "star", group: ESSENTIALS, core: true, description: "The skills that describe the work you do." },
  { id: "employment", label: "Employment", icon: "briefcase", group: EXPERIENCE, core: true, description: "Roles and organizations you have worked with." },
  { id: "journey", label: "Career journey", icon: "pulse", group: EXPERIENCE, core: true, description: "A timeline of chapters, memories, and people from your work." },
  { id: "education", label: "Education", icon: "building", group: EXPERIENCE, core: true, description: "Qualifications, institutions, and fields of study." },
  { id: "projects", label: "Projects", icon: "folder", group: EXPERIENCE, core: true, description: "Work you have built and can show in your portfolio." },
  { id: "onlineProfiles", label: "Public profile", icon: "link", group: CREDENTIALS, description: "Public profiles such as LinkedIn, GitHub, or a personal site." },
  { id: "workSamples", label: "Work samples", icon: "image", group: CREDENTIALS, description: "Case studies, demos, and other sample work with a link." },
  { id: "publications", label: "Publications & research", icon: "file", group: CREDENTIALS, description: "Papers, articles, books, and other published research." },
  { id: "presentations", label: "Presentations", icon: "monitor", group: CREDENTIALS, description: "Talks and events you have presented." },
  { id: "patents", label: "Patents", icon: "badge", group: CREDENTIALS, description: "Patent filings, grants, and issuing authorities." },
  { id: "certifications", label: "Certificates", icon: "shield", group: CREDENTIALS, description: "Issued credentials, licences, and expiry dates." },
  { id: "career", label: "Career profile", icon: "sliders", group: PREFERENCES, core: true, description: "Preferred roles, locations, and private compensation details." },
  { id: "personal", label: "Personal details", icon: "user", group: PREFERENCES, core: true, description: "Private account details that stay off public profiles." },
  { id: "languages", label: "Languages", icon: "globe", group: PREFERENCES, core: true, description: "Languages you use and how well you use them." },
  { id: "careerBreaks", label: "Career breaks", icon: "clock", group: PREFERENCES, description: "Optional gaps in your work history, private by default." },
];

export const PROFILE_SECTION_GROUPS_ORDER = [ESSENTIALS, EXPERIENCE, CREDENTIALS, PREFERENCES];
/** Optional sections offered in Add Section. Once added, they stay in the sidebar for this browser. */
export const ADDABLE_PROFILE_SECTIONS = ["onlineProfiles", "certifications"] as const;

function availableCatalog() {
  return PROFILE_SECTION_CATALOG.filter((section) => section.id !== "journey" || journeyEnabled);
}

function groupedCatalog(sections: ProfileEditorSection[]) {
  const groups = new Map<string, ProfileEditorSection[]>();
  for (const section of sections) {
    const rows = groups.get(section.group) ?? [];
    rows.push(section);
    groups.set(section.group, rows);
  }
  return PROFILE_SECTION_GROUPS_ORDER.flatMap((label) => {
    const items = groups.get(label);
    return items?.length ? [{ label, sections: items }] : [];
  });
}

/** Full catalog grouped by category, including optional credentials. */
export function availableProfileSectionGroups() {
  return groupedCatalog(availableCatalog());
}

function isAddableSection(id: string) {
  return (ADDABLE_PROFILE_SECTIONS as readonly string[]).includes(id);
}

function persistableOptionalId(id: string) {
  const section = profileSectionById(id);
  if (!section || section.core) return false;
  return !isCredentialSection(section) || isAddableSection(section.id);
}

function isCredentialSection(section: ProfileEditorSection | undefined) {
  return section?.group === CREDENTIALS;
}

/** Sections a person can still add. Core and already-added items are omitted. */
export function addableProfileSectionGroups(added: readonly string[] = []) {
  const present = new Set(
    profileSectionGroups(added).flatMap((group) => group.sections.map((section) => section.id)),
  );
  return groupedCatalog(
    availableCatalog().filter((section) => isAddableSection(section.id) && !present.has(section.id)),
  );
}

export function profileSectionById(id: string) {
  return availableCatalog().find((section) => section.id === id);
}

export function profileSectionGroups(added: readonly string[] = []): {
  label: string;
  sections: ProfileEditorSection[];
}[] {
  const visible = new Set(added);
  const groups = new Map<string, ProfileEditorSection[]>();
  for (const section of availableCatalog()) {
    if (isCredentialSection(section) && !isAddableSection(section.id)) continue;
    if (!section.core && !visible.has(section.id)) continue;
    const rows = groups.get(section.group) ?? [];
    rows.push(section);
    groups.set(section.group, rows);
  }
  return PROFILE_SECTION_GROUPS_ORDER.flatMap((label) => {
    const sections = groups.get(label);
    return sections?.length ? [{ label, sections }] : [];
  });
}

/** Sidebar and pagination: core sections plus any the person has added. */
export const PROFILE_SECTION_GROUPS = profileSectionGroups();
export const PROFILE_SECTIONS = availableCatalog();

const HASH_ALIASES: Record<string, string> = {
  technical: "skills",
  accomplishments: "onlineProfiles",
  diversity: "personal",
  public: "onlineProfiles",
  certificates: "certifications",
};

const ADDED_KEY = "skillora.profile.added-sections";
const addedEvent = "profile-added-sections";
const EMPTY_ADDED: string[] = [];
let addedSnapshotRaw: string | null = null;
let addedSnapshot: string[] = EMPTY_ADDED;

export function readAddedProfileSections(): string[] {
  if (typeof window === "undefined") return EMPTY_ADDED;
  try {
    const raw = localStorage.getItem(ADDED_KEY) ?? "[]";
    if (raw === addedSnapshotRaw) return addedSnapshot;
    const parsed = JSON.parse(raw) as unknown;
    const next = Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string" && persistableOptionalId(id))
      : EMPTY_ADDED;
    addedSnapshotRaw = raw;
    addedSnapshot = next.length ? next : EMPTY_ADDED;
    return addedSnapshot;
  } catch {
    addedSnapshotRaw = null;
    addedSnapshot = EMPTY_ADDED;
    return EMPTY_ADDED;
  }
}

export function rememberProfileSection(id: string) {
  if (!persistableOptionalId(id) || typeof window === "undefined") return;
  const current = readAddedProfileSections();
  if (current.includes(id)) return;
  localStorage.setItem(ADDED_KEY, JSON.stringify([...current, id]));
  addedSnapshotRaw = null;
  window.dispatchEvent(new Event(addedEvent));
}

function subscribeAdded(listener: () => void) {
  window.addEventListener(addedEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(addedEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

export function useProfileSectionGroups(active?: string) {
  const added = useSyncExternalStore(subscribeAdded, readAddedProfileSections, () => EMPTY_ADDED);
  return useMemo(() => {
    const extra = active && persistableOptionalId(active) ? [...added, active] : added;
    return profileSectionGroups(extra);
  }, [added, active]);
}

export function useVisibleProfileSections(active?: string) {
  const sections = useProfileSectionGroups(active).flatMap((group) => group.sections);
  const current = active ? profileSectionById(active) : undefined;
  if (current && !sections.some((section) => section.id === current.id)) return [...sections, current];
  return sections;
}

export function profileSectionFromHash(hash: string): string {
  const raw = hash.startsWith("#profile-") ? hash.slice(9) : "";
  const id = HASH_ALIASES[raw] ?? raw;
  return profileSectionById(id)?.id ?? "resume";
}

const navigationEvent = "profile-section-change";
type LeaveProceed = () => void;
let leaveGuard: ((proceed: LeaveProceed) => boolean) | null = null;
let guardedHref = "";

export function setProfileLeaveGuard(guard: ((proceed: LeaveProceed) => boolean) | null) {
  leaveGuard = guard;
  guardedHref = guard && typeof window !== "undefined" ? window.location.href : "";
}

function requestProfileLeave(proceed: LeaveProceed) {
  if (!leaveGuard || leaveGuard(proceed)) proceed();
}

function subscribe(listener: () => void) {
  const onNav = () => listener();
  const onUrl = () => {
    if (leaveGuard && window.location.href !== guardedHref) {
      const target = window.location.href;
      window.history.pushState(null, "", guardedHref);
      requestProfileLeave(() => {
        window.history.pushState(null, "", target);
        window.dispatchEvent(new Event(navigationEvent));
      });
      return;
    }
    listener();
  };
  window.addEventListener("hashchange", onUrl);
  window.addEventListener("popstate", onUrl);
  window.addEventListener(navigationEvent, onNav);
  return () => {
    window.removeEventListener("hashchange", onUrl);
    window.removeEventListener("popstate", onUrl);
    window.removeEventListener(navigationEvent, onNav);
  };
}
export const useProfileSection = () =>
  useSyncExternalStore(
    subscribe,
    () => profileSectionFromHash(window.location.hash),
    () => "resume",
  );

/** Block profile section / in-app navigation while an inline editor has unsaved changes. */
export function useProfileLeaveGuard(blocked: boolean, onBlocked: (proceed: () => void) => void) {
  const blockedRef = useRef(blocked);
  const onBlockedRef = useRef(onBlocked);
  blockedRef.current = blocked;
  onBlockedRef.current = onBlocked;
  useEffect(() => {
    const guard = (proceed: LeaveProceed) => {
      if (!blockedRef.current) return true;
      onBlockedRef.current(proceed);
      return false;
    };
    setProfileLeaveGuard(blocked ? guard : null);
    return () => setProfileLeaveGuard(null);
  }, [blocked]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (!blockedRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target instanceof Element ? event.target.closest("a[href]") : null) as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin) return;
      if (target.pathname === window.location.pathname && target.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      onBlockedRef.current(() => {
        window.location.assign(target.href);
      });
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (!blockedRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    document.addEventListener("click", click, true);
    window.addEventListener("beforeunload", unload);
    return () => {
      document.removeEventListener("click", click, true);
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
}

export function focusProfileSection() {
  const target = document.getElementById(
    window.location.hash === "#profile-identity"
      ? "profile-identity"
      : "profile-section-panel",
  );
  const scrollTarget =
    target?.id === "profile-section-panel" &&
    window.matchMedia("(max-width: 700px)").matches
      ? document.querySelector(".profile-section-navigation")
      : target;
  scrollTarget?.scrollIntoView({ block: "start", behavior: "auto" });
  if (target?.id === "profile-section-panel")
    target.focus({ preventScroll: true });
}

export function navigateToProfileSection(id: string) {
  if (id !== "identity" && !profileSectionById(id)) return;
  const apply = () => {
    rememberProfileSection(id);
    const before = profileSectionFromHash(window.location.hash);
    const hash = `#profile-${id}`;
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
      window.dispatchEvent(new Event(navigationEvent));
    }
    if (before === profileSectionFromHash(hash) || id === "identity")
      requestAnimationFrame(focusProfileSection);
    if (leaveGuard) guardedHref = window.location.href;
  };
  if (typeof window !== "undefined" && profileSectionFromHash(window.location.hash) !== id) {
    requestProfileLeave(apply);
    return;
  }
  apply();
}
