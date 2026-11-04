"use client";
import { useServiceQuery } from "./use-services";
import { apiConfig } from "@/services/api/config";

/** Observe the current server revision without replacing the editor's captured draft. */
export function useEditorRevision(kind: "profile" | "project" | "update", revision?: number, id?: string) {
  const query = useServiceQuery(kind === "profile" ? [kind] : [kind,id], async s => kind === "profile" ? s.profile.getProfile() : kind === "project" ? s.work.getProject(id!) : s.work.getUpdate(id!), { enabled: apiConfig.dataSource === "http" && revision !== undefined && (kind === "profile" || !!id) });
  return apiConfig.dataSource === "http" && revision !== undefined && (query.isError || query.data?.version !== undefined && query.data.version !== revision);
}
