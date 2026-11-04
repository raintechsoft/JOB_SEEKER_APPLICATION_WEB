import { Suspense } from "react";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { SearchScreen } from "@/features/search/search-screen";

export const metadata = { title: "Search results" };
export default function SearchPage() { return <Suspense fallback={<ContentSkeleton layout="list" label="Loading search results" />}><SearchScreen role="professional" /></Suspense>; }
