"use client";

import { useServiceQuery } from "@/hooks/use-services";
import { Avatar, LinkButton } from "@/components/ui/primitives";
import { EmptyPanel, ErrorState } from "@/components/ui/state-views";
import { CardSkeleton, LoadingRegion } from "@/components/ui/skeleton";
import { ProjectCard } from "@/components/work/project-card";
import {apiConfig} from "@/services/api/config";

const FEATURED_PROJECTS = ["proj0", "proj2", "proj3"];

/** Alex Morgan's portrait in the hero profile preview (reflects local profile edits). */
export function HeroAvatar() {
  const { data } = useServiceQuery(["shell", "professional"], (s) => s.workspace.getProfessionalShell(),{enabled:apiConfig.dataSource==="mock"});
  return data ? <Avatar person={data.person} size="lg" /> : <Avatar person={{ id: "illustration", name: apiConfig.dataSource==="mock"?"Alex Morgan":"Your professional story", color: "#dddaf5" }} size="lg" />;
}

export function HomeProjects() {
  const { data,isError,error,refetch } = useServiceQuery(["projects", "home"], (s) => apiConfig.dataSource==="http"?s.work.featuredProjects!():s.work.getProjects(FEATURED_PROJECTS));
  return (
    <div className="ph-project-grid">
      {!data&&!isError&&<LoadingRegion label="Loading featured projects"><CardSkeleton /></LoadingRegion>}
      {isError&&!data&&<ErrorState compact error={error} onRetry={()=>refetch()} title="Featured projects couldn’t load" description="Something interrupted the request. Please try again." />}
      {data?.length===0&&<EmptyPanel compact icon="folder" title="No featured projects yet" description="Projects shared publicly by professionals will appear here." action={<LinkButton href="/talent">Explore talent</LinkButton>} />}
      {data?.map((p) => (
        <ProjectCard key={p.id} project={p} compact />
      ))}
    </div>
  );
}
