import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SettingsApp } from "@/features/settings/settings-layout";
import { defaultSettingsSection, isHiddenSettingsSection, isSettingsSectionForRole, settingsBasePath, SETTINGS_SECTIONS, type SettingsSectionId } from "@/features/settings/settings-catalog";

export const metadata: Metadata = { title: "settings" };

export function generateStaticParams() {
  return SETTINGS_SECTIONS.map((section) => ({ section }));
}

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (isHiddenSettingsSection(section)) redirect(`${settingsBasePath("professional")}/${defaultSettingsSection("professional")}`);
  if (!isSettingsSectionForRole(section, "professional")) notFound();
  return <SettingsApp role="professional" section={section as SettingsSectionId} />;
}
