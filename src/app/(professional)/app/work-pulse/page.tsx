import type { Metadata } from "next";

import { WorkPulseScreen } from "@/features/work/work-screens";

export const metadata: Metadata = { title: "work pulse" };

export default function Page() {
  return <WorkPulseScreen />;
}
