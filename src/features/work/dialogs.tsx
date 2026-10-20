"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import type { Id, IsoDate, Project, WorkUpdate } from "@/types/domain";
import { formatLongDate, formatShortDate, today } from "@/lib/utils/date";
import { parseSkills } from "@/lib/utils/text";
import { safeUrl } from "@/lib/utils/url";
import { devCopy } from "@/lib/env/app-env";
import { useZodForm } from "@/lib/validation/form";
import { projectSchema, updateSchema, type ProjectFormValues, type UpdateFormValues } from "@/lib/validation/work";
import { useServiceAction, useServiceQuery, useServices } from "@/hooks/use-services";
import { modal, useModalStore } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Icon } from "@/components/ui/icon";
import { Badge, Button, EmptyState } from "@/components/ui/primitives";
import { DevOnly } from "@/components/ui/dev-only";
import { CheckRow, FileField, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { confirmAction, FormError } from "@/components/ui/feedback";
import { ProjectCard } from "@/components/work/project-card";
import { UpdateItem } from "@/components/work/pulse";

const STORAGE_FALLBACK = "Saved for this page only. Browser storage is full or unavailable.";

// ---------------------------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------------------------

function ProjectDetails({ id }: { id: Id }) {
  const pathname = usePathname();
  const { data: project } = useServiceQuery(["project", id], (s) => s.work.getProject(id));
  const dialogs = useProjectDialogs();
  if (!project) return null;
  return (
    <>
      <ProjectCard project={project} />
      <div className="stack" style={{ marginTop: 22 }}>
        <div>
          <h3>My contribution</h3>
          <p className="small muted" style={{ marginTop: 10 }}>
            {project.contribution}
          </p>
        </div>
        <div className="row between">
          <span className="small muted">
            {formatShortDate(project.start)} — {formatShortDate(project.date)}
          </span>
          <Badge tone="purple">{project.visibility}</Badge>
        </div>
        <div className="row wrap">
          {safeUrl(project.url) && (
            <a className="btn" href={project.url} target="_blank" rel="noopener">
              Visit project <Icon name="external" />
            </a>
          )}
          {safeUrl(project.repository) && (
            <a className="btn" href={project.repository} target="_blank" rel="noopener">
              Repository <Icon name="external" />
            </a>
          )}
          {project.owner === "p0" && pathname.startsWith("/app") && (
            <Button variant="primary" icon="edit" onClick={() => dialogs.edit(project.id)}>
              Edit project
            </Button>
          )}
        </div>
        <DevOnly>
          <p className="notice">Sample projects and external example links illustrate the prototype. Uploaded covers stay in this browser.</p>
        </DevOnly>
      </div>
    </>
  );
}

function ProjectForm({ project }: { project: Project | null }) {
  const run = useServiceAction();
  const pathname = usePathname();
  const setDirty = useModalStore((s) => s.setDirty);
  const dialogs = useProjectDialogs();
  const [error, setError] = useState("");
  const form = useZodForm(projectSchema, {
    title: project?.title ?? "",
    category: project?.category ?? "Design",
    description: project?.description ?? "",
    contribution: project?.contribution ?? "",
    skills: project?.skills.join(", ") ?? "",
    url: project?.url ?? "",
    repository: project?.repository ?? "",
    start: project?.start ?? today(),
    date: project?.date ?? today(),
    visibility: project?.visibility ?? "Public",
    featured: project?.featured ?? false,
    coverFile: null,
  } satisfies ProjectFormValues);
  const { register, handleSubmit } = form;

  const submit = handleSubmit(async (v) => {
    const skills = parseSkills(v.skills);
    if (!skills.length) {
      toast("Add at least one skill.");
      return;
    }
    const result = await run((s) => s.work.saveProject({ id: project?.id, title: v.title, category: v.category, description: v.description, contribution: v.contribution, skills, url: v.url, repository: v.repository, start: v.start, date: v.date, visibility: v.visibility, featured: v.featured, coverFile: v.coverFile?.[0] ?? null }));
    if (!result) return;
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast(result.persisted ? "Project saved to your profile and portfolio." : STORAGE_FALLBACK);
    modal.close();
  });

  return (
    <form id="project-form" className="stack" noValidate={false} onSubmit={submit} onInput={() => pathname === "/app/profile" && setDirty(true)}>
      <div className="grid cols2">
        <TextField label="Project title" required maxLength={120} {...register("title")} />
        <SelectField label="Discipline" options={["Design", "Engineering", "Data", "Business"]} {...register("category")} />
      </div>
      <TextAreaField label="Project overview" required maxLength={2000} {...register("description")} />
      <TextAreaField label="Your role & contribution" required maxLength={1200} {...register("contribution")} />
      <TextField label="Skills & technologies (comma separated)" required {...register("skills")} />
      <FileField label="Project cover image (optional)" id="project-cover" accept="image/png,image/jpeg,image/webp" hint="PNG, JPEG, or WebP up to 1 MB. Kept in local browser storage." {...register("coverFile")} />
      <div className="grid cols2">
        <TextField label="Project URL" type="url" {...register("url")} />
        <TextField label="Repository URL" type="url" {...register("repository")} />
        <TextField label="Start date" type="date" required max={today()} {...register("start")} />
        <TextField label="Completion date" type="date" required max={today()} {...register("date")} />
        <SelectField label="Visibility" options={["Public", "Private"]} {...register("visibility")} />
      </div>
      <CheckRow {...register("featured")}>Feature this project in my portfolio</CheckRow>
      <div id="project-error">
        <FormError message={error} />
      </div>
      <div className="modal-footer">
        {project && (
          <Button variant="danger sm" icon="trash" onClick={() => dialogs.remove(project.id)}>
            Delete project
          </Button>
        )}
        <Button onClick={() => modal.requestClose()}>Cancel</Button>
        <Button type="submit" variant="primary" icon="check">
          Save project
        </Button>
      </div>
    </form>
  );
}

function ProjectFormLoader({ id }: { id: Id }) {
  const { data } = useServiceQuery(["project", id], (s) => s.work.getProject(id));
  return data === undefined ? null : <ProjectForm project={data} />;
}

export function useProjectDialogs() {
  const run = useServiceAction();
  const services = useServices();
  const view = useCallback(
    async (id: Id) => {
      const p = await services.work.getProject(id);
      if (p) modal.show(p.title, <ProjectDetails id={id} />);
    },
    [services],
  );
  const edit = useCallback((id?: Id) => {
    if (!id) {
      modal.show("Bring a project to life", <ProjectForm project={null} />, "project");
      return;
    }
    modal.show("Edit your project", <ProjectFormLoader id={id} />, "project");
  }, []);
  const remove = useCallback(
    (id: Id) =>
      confirmAction("Delete this project?", "It will be removed from your profile and portfolio. Related updates will remain.", async () => {
        await run((s) => s.work.deleteProject(id));
        modal.close();
        toast("Project removed from your profile and portfolio.");
      }),
    [run],
  );
  return { view, edit, create: () => edit(), remove };
}


// ---------------------------------------------------------------------------------------------
// Work updates
// ---------------------------------------------------------------------------------------------

function UpdateForm({ update }: { update: WorkUpdate | null }) {
  const run = useServiceAction();
  const { data: settings } = useServiceQuery(["settings"], (s) => s.workspace.getSettings());
  const { data: projects } = useServiceQuery(["projects", "p0", "all"], (s) => s.work.listProjects({ ownerId: "p0" }));
  if (!settings || !projects) return null;
  return <UpdateFormFields update={update} defaultVisibility={settings.updatesPublic ? "Public" : "Private"} projects={projects} run={run} />;
}

function UpdateFormFields({ update, defaultVisibility, projects, run }: { update: WorkUpdate | null; defaultVisibility: "Public" | "Private"; projects: Project[]; run: ReturnType<typeof useServiceAction> }) {
  const { register, handleSubmit } = useZodForm(updateSchema, {
    title: update?.title ?? "",
    description: update?.description ?? "",
    category: update?.category ?? "Design",
    date: update?.date ?? today(),
    skills: update?.skills.join(", ") ?? "",
    project: update?.project ?? "",
    visibility: update?.visibility ?? defaultVisibility,
  } satisfies UpdateFormValues);
  const submit = handleSubmit(async (v) => {
    const ok = await run((s) => s.work.saveUpdate({ id: update?.id, title: v.title, description: v.description, category: v.category, date: v.date, skills: parseSkills(v.skills), project: v.project, visibility: v.visibility }));
    if (ok === undefined) return;
    toast(ok ? "Work update saved. Your Work Pulse is up to date." : "Update saved in memory; browser storage unavailable.");
    modal.close();
  });
  return (
    <form id="update-form" className="stack" onSubmit={submit}>
      <TextField label="Update title" required maxLength={150} placeholder="What did you work on?" {...register("title")} />
      <TextAreaField label="The story behind it" required maxLength={2000} placeholder="What did you make, learn, or move forward?" {...register("description")} />
      <div className="grid cols2">
        <SelectField label="Category" options={["Design", "Development", "Research", "Learning", "Marketing", "Collaboration"]} {...register("category")} />
        <TextField label="Date" type="date" required max={today()} {...register("date")} />
      </div>
      <TextField label="Skills (comma separated)" required {...register("skills")} />
      <SelectField label="Related project" options={[{ label: "No related project", value: "" }, ...projects.map((p) => ({ label: p.title, value: p.id }))]} {...register("project")} />
      <SelectField label="Visibility" options={["Public", "Private"]} {...register("visibility")} />
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary" icon="check">
          {update ? "Save update" : "Publish update"}
        </Button>
      </div>
    </form>
  );
}

function UpdateFormLoader({ id }: { id: Id }) {
  const { data } = useServiceQuery(["update", id], (s) => s.work.getUpdate(id));
  return data === undefined ? null : <UpdateForm update={data} />;
}

function UpdateDetails({ id }: { id: Id }) {
  const { data: update } = useServiceQuery(["update", id], (s) => s.work.getUpdate(id));
  const { data: project } = useServiceQuery(["project", update?.project], (s) => s.work.getProject(update!.project), { enabled: !!update?.project });
  const projects = useProjectDialogs();
  if (!update) return null;
  return (
    <>
      <UpdateItem update={update} />
      {project && (
        <>
          <hr className="divider" />
          <Button icon="folder" onClick={() => projects.view(project.id)}>
            View related project
          </Button>
        </>
      )}
    </>
  );
}

function PulseDay({ ownerId, date }: { ownerId: Id; date: IsoDate }) {
  const pathname = usePathname();
  const inWorkspace = pathname.startsWith("/app");
  const { data } = useServiceQuery(["updates", ownerId, date, inWorkspace], (s) => s.work.listUpdates(ownerId, { date, publicOnly: !inWorkspace }));
  const dialogs = useUpdateDialogs();
  if (!data) return null;
  return data.length ? (
    <>
      {data.map((u) => (
        <UpdateItem key={u.id} update={u} />
      ))}
    </>
  ) : (
    <EmptyState
      title="A little space in your story."
      description="No visible updates were recorded on this day."
      action={
        inWorkspace ? (
          <Button variant="primary" icon="plus" onClick={() => dialogs.create()}>
            Add a work update
          </Button>
        ) : null
      }
    />
  );
}

export function useUpdateDialogs() {
  const run = useServiceAction();
  const services = useServices();
  return {
    create: () => modal.show("A little progress worth sharing.", <UpdateForm update={null} />),
    edit: (id: Id) => modal.show("Edit work update", <UpdateFormLoader id={id} />),
    view: async (id: Id) => {
      const u = await services.work.getUpdate(id);
      if (u) modal.show(u.title, <UpdateDetails id={id} />);
    },
    remove: (id: Id) =>
      confirmAction("Delete this update?", devCopy("It will be removed from your feed and Work Pulse in this browser.", "It will be removed from your feed and Work Pulse."), async () => {
        await run((s) => s.work.deleteUpdate(id));
        modal.close();
        toast("Update removed. Your Work Pulse is up to date.");
      }),
    day: (ownerId: Id, date: IsoDate) => modal.show(formatLongDate(date), <PulseDay ownerId={ownerId} date={date} />),
  };
}
