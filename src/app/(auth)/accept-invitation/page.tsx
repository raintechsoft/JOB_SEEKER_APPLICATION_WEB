import { Suspense } from "react";
import { AccountActionScreen } from "@/features/auth/account-screens";

export const metadata = { title: "Organization invitation" };
export default function Page() { return <Suspense><AccountActionScreen mode="invite" /></Suspense>; }
