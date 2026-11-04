"use client";

import { Icon } from "@/components/ui/icon";
import { modal } from "@/stores/modal-store";
import {
  addableProfileSectionGroups,
  navigateToProfileSection,
  type ProfileEditorSection,
} from "./profile-navigation";

export function openAddProfileSection(added: readonly string[]) {
  modal.show("Add Section", <AddProfileSectionDialog added={added} />);
}

function AddProfileSectionDialog({ added }: { added: readonly string[] }) {
  const groups = addableProfileSectionGroups(added);
  return (
    <div className="profile-add-section-dialog">
      {groups.length ? (
        <p>Choose a section to add to your profile.</p>
      ) : (
        <p>There are no more sections to add right now.</p>
      )}
      {groups.map((group) => (
        <section key={group.label} className="profile-add-section-group">
          <h3>{group.label}</h3>
          <ul>
            {group.sections.map((section) => (
              <SectionChoice key={section.id} section={section} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SectionChoice({ section }: { section: ProfileEditorSection }) {
  return (
    <li>
      <button
        type="button"
        className="profile-add-section-choice"
        onClick={() => {
          navigateToProfileSection(section.id);
          modal.close();
        }}
      >
        <span className="profile-add-section-icon" aria-hidden="true">
          <Icon name={section.icon} />
        </span>
        <span className="profile-add-section-copy">
          <strong>{section.label}</strong>
          <small>{section.description}</small>
        </span>
        <span className="profile-add-section-status">Add</span>
      </button>
    </li>
  );
}
