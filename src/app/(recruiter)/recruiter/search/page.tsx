import { Suspense } from "react";
import { ScreenFallback } from "@/components/ui/feedback";
import { SearchScreen } from "@/features/search/search-screen";

export const metadata = { title: "Search results" };
export default function SearchPage() { return <Suspense fallback={<ScreenFallback layout="list" label="Loading search" />}><SearchScreen role="recruiter" /></Suspense>; }
