"use client";

import { useServiceQuery } from "@/hooks/use-services";
import { Avatar } from "@/components/ui/primitives";
import { ProjectCard } from "@/components/work/project-card";
import {apiConfig} from "@/services/api/config";

const FEATURED_PROJECTS = ["proj0", "proj2", "proj3"];

/** Alex Morgan's portrait in the hero profile preview (reflects local profile edits). */
export function HeroAvatar() {
  const { data } = useServiceQuery(["shell", "professional"], (s) => s.workspace.getProfessionalShell(),{enabled:apiConfig.dataSource==="mock"});
  return data ? <Avatar person={data.person} size="lg" /> : <Avatar person={{ id: "illustration", name: apiConfig.dataSource==="mock"?"Alex Morgan":"Your professional story", color: "#dddaf5" }} size="lg" />;
}

export function HomeProjects() {
  const { data,isError } = useServiceQuery(["projects", "home"], (s) => apiConfig.dataSource==="http"?s.work.featuredProjects!():s.work.getProjects(FEATURED_PROJECTS));
  return (
    <div className="ph-project-grid">
      {isError&&<p role="alert">Public projects could not be loaded.</p>}
      {data?.map((p) => (
        <ProjectCard key={p.id} project={p} compact />
      ))}
    </div>
  );
}
