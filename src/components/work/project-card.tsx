"use client";

import type { Project } from "@/types/domain";
import { formatShortDate } from "@/lib/utils/date";
import { Icon } from "@/components/ui/icon";
import { Button, IconButton, Tags } from "@/components/ui/primitives";
import { useProjectDialogs } from "@/features/work/dialogs";
import { ProjectArt } from "./project-art";

export function ProjectCard({ project, manage = false, compact = false }: { project: Project; manage?: boolean; compact?: boolean }) {
  const dialogs = useProjectDialogs();
  return (
    <article className="card project-card">
      <ProjectArt project={project} />
      <div className="project-body">
        <div className="row between">
          <span className="eyebrow" style={{ fontSize: 8, letterSpacing: ".8px" }}>
            {project.category}
          </span>
          {project.featured && (
            <span className="tag purple">
              <Icon name="star" /> Featured
            </span>
          )}
        </div>
        <h3>{project.title}</h3>
        {!compact && <p>{project.description.slice(0, 115)}…</p>}
        <Tags items={project.skills.slice(0, 3)} />
        <div className="row between project-bottom">
          <span className="small muted" style={{ fontSize: 9 }}>
            {formatShortDate(project.date)} · {project.visibility}
          </span>
          <div className="row gap8">
            {manage && <IconButton icon="edit" label="Edit project" onClick={() => dialogs.edit(project.id)} />}
            <Button variant="text sm" icon="arrowUp" onClick={() => dialogs.view(project.id)}>
              View project
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
