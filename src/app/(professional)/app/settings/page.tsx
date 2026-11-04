import type { Metadata } from "next";
import { SettingsApp } from "@/features/settings/settings-layout";

export const metadata: Metadata = { title: "settings" };

export default function Page() {
  return <SettingsApp role="professional" />;
}
