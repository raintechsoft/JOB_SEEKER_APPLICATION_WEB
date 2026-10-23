import { Suspense } from "react";
import { AccountActionScreen } from "@/features/auth/account-screens";

export const metadata = { title: "Choose a password" };
export default function Page() { return <Suspense><AccountActionScreen mode="reset" /></Suspense>; }
