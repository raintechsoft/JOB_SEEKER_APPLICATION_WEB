import { Suspense } from "react";
import { AccountActionScreen } from "@/features/auth/account-screens";
import { ScreenFallback } from "@/components/ui/feedback";

export const metadata = { title: "Organization invitation" };
export default function Page() { return <Suspense fallback={<ScreenFallback layout="form" label="Loading invitation" />}><AccountActionScreen mode="invite" /></Suspense>; }
