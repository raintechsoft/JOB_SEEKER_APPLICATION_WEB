"use client";

import { useSyncExternalStore } from "react";
import type { IconName } from "@/components/ui/icon";
import { journeyEnabled } from "@/services/journey/journey.service";

interface EditorSection {
  id: string;
  label: string;
  icon: IconName;
}
export const PROFILE_SECTION_GROUPS: {
  label: string;
  sections: EditorSection[];
}[] = [
  {
    label: "Profile essentials",
    sections: [
      { id: "resume", label: "Resume", icon: "file" },
      { id: "headline", label: "Resume headline", icon: "edit" },
      { id: "summary", label: "Profile summary", icon: "message" },
      { id: "skills", label: "Key skills", icon: "star" },
    ],
  },
  {
    label: "Experience & work",
    sections: [
      { id: "employment", label: "Employment", icon: "briefcase" },
      ...(journeyEnabled
        ? [
            {
              id: "journey",
              label: "Career journey",
              icon: "pulse" as IconName,
            },
          ]
        : []),
      { id: "education", label: "Education", icon: "building" },
      { id: "technical", label: "Technical skills", icon: "monitor" },
      { id: "projects", label: "Projects", icon: "folder" },
      { id: "accomplishments", label: "Accomplishments", icon: "shield" },
    ],
  },
  {
    label: "Preferences & details",
    sections: [
      { id: "career", label: "Career profile", icon: "sliders" },
      { id: "personal", label: "Personal details", icon: "user" },
      { id: "languages", label: "Languages", icon: "globe" },
      { id: "diversity", label: "Diversity & inclusion", icon: "users" },
    ],
  },
];
export const PROFILE_SECTIONS = PROFILE_SECTION_GROUPS.flatMap(
  (group) => group.sections,
);
export function profileSectionFromHash(hash: string): string {
  const id = hash.startsWith("#profile-") ? hash.slice(9) : "";
  return PROFILE_SECTIONS.some((section) => section.id === id) ? id : "resume";
}
const navigationEvent = "profile-section-change";
function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  window.addEventListener(navigationEvent, listener);
  return () => {
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("popstate", listener);
    window.removeEventListener(navigationEvent, listener);
  };
}
export const useProfileSection = () =>
  useSyncExternalStore(
    subscribe,
    () => profileSectionFromHash(window.location.hash),
    () => "resume",
  );

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
  if (
    id !== "identity" &&
    !PROFILE_SECTIONS.some((section) => section.id === id)
  )
    return;
  const before = profileSectionFromHash(window.location.hash);
  const hash = `#profile-${id}`;
  if (window.location.hash !== hash) {
    window.history.pushState(null, "", hash);
    window.dispatchEvent(new Event(navigationEvent));
  }
  if (before === profileSectionFromHash(hash) || id === "identity")
    requestAnimationFrame(focusProfileSection);
}
