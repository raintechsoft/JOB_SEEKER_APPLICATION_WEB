"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { PageHeading } from "@/components/ui/primitives";
import { devCopy } from "@/lib/env/app-env";
import { cn } from "@/lib/utils/text";
import type { Role } from "@/types/domain";
import { defaultSettingsSection, settingsBasePath, settingsCategoriesFor, type SettingsSectionId } from "./settings-catalog";
import { SettingsPanel } from "./settings-panels";
import "./settings-layout.css";

const DESKTOP_SETTINGS = "(min-width: 851px)";

export function SettingsApp({ role, section }: { role: Role; section?: SettingsSectionId }) {
  const router = useRouter();
  const base = settingsBasePath(role);
  const categories = settingsCategoriesFor(role);
  const first = defaultSettingsSection(role);
  const current = section ? categories.find((category) => category.id === section) : undefined;

  useEffect(() => {
    if (section) return;
    const media = window.matchMedia(DESKTOP_SETTINGS);
    const go = () => {
      if (media.matches) router.replace(`${base}/${first}`);
    };
    go();
    media.addEventListener("change", go);
    return () => media.removeEventListener("change", go);
  }, [section, base, first, router]);

  return (
    <>
      {section ? (
        <div className="page-heading">
          <div>
            <Link href={base} className="settings-back" aria-label="Back to Settings">
              <Icon name="chevron" />
              Settings
            </Link>
            <h1>{current?.label ?? "Settings"}</h1>
          </div>
        </div>
      ) : (
        <PageHeading
          title={role === "professional" ? "Settings" : ''}
          subtitle=""
        />
      )}
      <div className={cn("settings-layout", section ? "is-section" : "is-index")}>
        <aside className="settings-nav">
          <div className="settings-nav-heading">
            <span className="settings-nav-label">Categories</span>
            <h2>Settings</h2>
          </div>
          <nav aria-label="Settings categories">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`${base}/${category.id}`}
                aria-current={section === category.id ? "page" : undefined}
                className={section === category.id ? "is-current" : undefined}
              >
                <Icon name={category.icon} />
                <span>
                  <strong>{category.label}</strong>
                  <small>{category.description}</small>
                </span>
                <Icon name="chevron" />
              </Link>
            ))}
          </nav>
        </aside>
        <div className="settings-panel">{section ? <SettingsPanel role={role} section={section} /> : null}</div>
      </div>
    </>
  );
}
