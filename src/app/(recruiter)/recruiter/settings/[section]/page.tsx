import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SettingsApp } from "@/features/settings/settings-layout";
import { defaultSettingsSection, isHiddenSettingsSection, isSettingsSectionForRole, settingsBasePath, SETTINGS_SECTIONS, type SettingsSectionId } from "@/features/settings/settings-catalog";

export const metadata: Metadata = { title: "Settings" };

export function generateStaticParams() {
  return SETTINGS_SECTIONS.map((section) => ({ section }));
}

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (isHiddenSettingsSection(section)) redirect(`${settingsBasePath("recruiter")}/${defaultSettingsSection("recruiter")}`);
  if (!isSettingsSectionForRole(section, "recruiter")) notFound();
  return <SettingsApp role="recruiter" section={section as SettingsSectionId} />;
}
