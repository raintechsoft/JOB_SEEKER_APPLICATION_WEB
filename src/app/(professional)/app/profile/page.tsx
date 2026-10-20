import type { Metadata } from "next";

import { ProfileScreen } from "@/features/profile/profile-screen";

export const metadata: Metadata = { title: "profile" };

export default function Page() {
  return <ProfileScreen />;
}
