"use client";

import { Icon } from "@/components/ui/icon";
import { useEffect, useState } from "react";
import { openAddProfileSection } from "./add-profile-section-dialog";
import {
  addableProfileSectionGroups,
  navigateToProfileSection,
  profileSectionById,
  readAddedProfileSections,
  useProfileSectionGroups,
} from "./profile-navigation";

export function ProfileSectionNavigation({ active }: { active: string }) {
  const groups = useProfileSectionGroups(active);
  const current = profileSectionById(active);
  const listed = groups.some((group) => group.sections.some((section) => section.id === active));
  const listedIds = groups.flatMap((group) => group.sections.map((section) => section.id));
  const canAdd = addableProfileSectionGroups(listedIds).length > 0;
  return (
    <aside className="profile-quick-links profile-section-navigation">
      <div className="profile-navigation-heading">
        <span className="profile-navigation-eyebrow">
          YOUR PROFESSIONAL STORY
        </span>
        <h2>Edit profile</h2>
      </div>
      <DesktopSectionGroups active={active} groups={groups} />
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
          {!listed && current && <option value={current.id}>{current.label}</option>}
          {groups.map((group) => (
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
      {canAdd && (
        <button
          type="button"
          className="profile-add-section"
          onClick={() => openAddProfileSection(readAddedProfileSections())}
        >
          <Icon name="plus" />
          Add Section
        </button>
      )}
    </aside>
  );
}

function DesktopSectionGroups({
  active,
  groups,
}: {
  active: string;
  groups: ReturnType<typeof useProfileSectionGroups>;
}) {
  const activeGroup =
    groups.find((group) => group.sections.some((section) => section.id === active))?.label ??
    groups[0]?.label ??
    "";
  const [expanded, setExpanded] = useState(activeGroup);
  useEffect(() => {
    if (activeGroup) setExpanded(activeGroup);
  }, [activeGroup]);
  return (
    <nav aria-label="Profile sections" className="profile-navigation-desktop">
      {groups.map((group, index) => {
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
                onClick={() => setExpanded(group.label)}
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
