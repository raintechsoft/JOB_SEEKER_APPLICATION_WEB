"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { Role } from "@/types/domain";
import { useUiStore } from "@/stores/ui-store";
import { feedSearchSchema } from "@/lib/validation/social";

/**
 * Applies `?view=` and `?post=` from the URL to the session feed state, as the prototype did on render:
 * `post` shows the full "For you" list so the permalinked post can be highlighted.
 */
export function useFeedParams(role: Role) {
  const params = useSearchParams();
  const setFeed = useUiStore((s) => s.setFeed);
  const post = params.get("post");
  const view = params.get("view");
  const query = params.get("q");
  useEffect(() => {
    if (post) setFeed({ filter: "all", query: "", visible: 100 });
    else if (query !== null) {
      const parsed = feedSearchSchema.safeParse(query);
      setFeed({ filter: "all", query: parsed.success ? parsed.data : "", visible: 12 });
    }
    if (view !== null) {
      if (view === "reposts") setFeed({ filter: "reposts", query: "", visible: 12 });
      else if (role === "professional") setFeed({ filter: view === "saved" || view === "jobs" ? view : "all" });
      else setFeed({ filter: view === "saved" ? "saved" : "all" });
    }
  }, [post, view, query, role, setFeed]);
}
