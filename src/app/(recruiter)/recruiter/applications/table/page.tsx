import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenFallback } from "@/components/ui/feedback";
import { ResponseCenterScreen } from "@/features/recruiting/response-center-screen";

export const metadata: Metadata = { title: "Responses table" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenFallback layout="list" label="Loading responses table" />}>
      <ResponseCenterScreen mode="table" />
    </Suspense>
  );
}
