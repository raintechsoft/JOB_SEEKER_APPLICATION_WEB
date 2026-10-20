import type { Metadata } from "next";

import { SettingsScreen } from "@/features/settings/settings-screen";

export const metadata: Metadata = { title: "settings" };

export default function Page() {
  return <SettingsScreen />;
}
