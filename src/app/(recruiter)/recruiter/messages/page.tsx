import type { Metadata } from "next";
import { MessagingScreen } from "@/features/messaging/messaging-screen";

export const metadata: Metadata = { title: "messages" };

export default function Page() {
  return <MessagingScreen role="recruiter" />;
}
