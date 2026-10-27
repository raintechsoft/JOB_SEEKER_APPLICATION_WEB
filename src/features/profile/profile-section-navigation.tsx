"use client";

import { Icon } from "@/components/ui/icon";
import { useState } from "react";
import {
  PROFILE_SECTION_GROUPS,
  navigateToProfileSection,
} from "./profile-navigation";

export function ProfileSectionNavigation({ active }: { active: string }) {
  return (
    <aside className="profile-quick-links profile-section-navigation">
      <div className="profile-navigation-heading">
        <span className="profile-navigation-eyebrow">
          YOUR PROFESSIONAL STORY
        </span>
        <h2>Edit profile</h2>
        <p>A little detail makes a difference.</p>
      </div>
      <DesktopSectionGroups key={active} active={active} />
      <label
        className="profile-navigation-mobile"
        htmlFor="profile-section-picker"
      >
        <span>Choose a section</span>
        <select
          id="profile-section-picker"
          aria-label="Profile section"
          value={active}
          onChange={(event) => navigateToProfileSection(event.target.value)}
        >
          {PROFILE_SECTION_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </aside>
  );
}

function DesktopSectionGroups({ active }: { active: string }) {
  const [expanded, setExpanded] = useState<string | null>(
    () =>
      PROFILE_SECTION_GROUPS.find((group) =>
        group.sections.some((section) => section.id === active),
      )?.label ?? PROFILE_SECTION_GROUPS[0].label,
  );
  return (
    <nav aria-label="Profile sections" className="profile-navigation-desktop">
      {PROFILE_SECTION_GROUPS.map((group, index) => {
        const open = expanded === group.label;
        const current = group.sections.some((section) => section.id === active);
        const panelId = `profile-navigation-group-${index}`;
        return (
          <div className="profile-navigation-group" key={group.label}>
            <h3>
              <button
                type="button"
                className="profile-group-toggle"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setExpanded(open ? null : group.label)}
              >
                <span>{group.label}</span>
                {current && (
                  <span
                    className="profile-group-current"
                    aria-label="Contains current section"
                  />
                )}
                <Icon name="chevron" />
              </button>
            </h3>
            <div className="profile-group-sections" id={panelId} hidden={!open}>
              {group.sections.map((section) => (
                <a
                  key={section.id}
                  id={`profile-nav-${section.id}`}
                  href={`#profile-${section.id}`}
                  className={`profile-nav-link${active === section.id ? " active" : ""}`}
                  aria-current={active === section.id ? "page" : undefined}
                  onClick={(event) => {
                    if (
                      event.ctrlKey ||
                      event.metaKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    event.preventDefault();
                    navigateToProfileSection(section.id);
                  }}
                >
                  <Icon name={section.icon} />
                  <span>{section.label}</span>
                  <Icon name="chevron" />
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
