import { VerifyEmailScreen } from "@/features/auth/account-screens";
import {Suspense} from "react";
import { ScreenFallback } from "@/components/ui/feedback";

export const metadata = { title: "Verify email" };
export default function Page() { return <Suspense fallback={<ScreenFallback layout="form" label="Loading email verification" />}><VerifyEmailScreen /></Suspense>; }
