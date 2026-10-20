"use client";

import { useServiceQuery } from "@/hooks/use-services";
import { Avatar } from "@/components/ui/primitives";
import { ProjectCard } from "@/components/work/project-card";

const FEATURED_PROJECTS = ["proj0", "proj2", "proj3"];

/** Alex Morgan's portrait in the hero profile preview (reflects local profile edits). */
export function HeroAvatar() {
  const { data } = useServiceQuery(["shell", "professional"], (s) => s.workspace.getProfessionalShell());
  return data ? <Avatar person={data.person} size="lg" /> : <Avatar person={{ id: "p0", name: "Alex Morgan", color: "#dddaf5" }} size="lg" />;
}

export function HomeProjects() {
  const { data } = useServiceQuery(["projects", "home"], (s) => s.work.getProjects(FEATURED_PROJECTS));
  return (
    <div className="ph-project-grid">
      {data?.map((p) => (
        <ProjectCard key={p.id} project={p} compact />
      ))}
    </div>
  );
}
