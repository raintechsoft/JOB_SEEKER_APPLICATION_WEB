import type { Metadata } from "next";
import { PageHeading } from "@/components/ui/primitives";
import { NotificationPreferences } from "@/features/settings/notification-preferences";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return <><PageHeading title="Settings" subtitle="Manage how you receive updates from Skillora." /><NotificationPreferences /></>;
}
