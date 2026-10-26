import { Suspense } from "react";
import { SearchScreen } from "@/features/search/search-screen";

export const metadata = { title: "Search results" };
export default function SearchPage() { return <Suspense fallback={null}><SearchScreen role="recruiter" /></Suspense>; }
