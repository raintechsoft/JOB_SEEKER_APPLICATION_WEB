"use client";
import { QueryFeedback } from "@/components/ui/query-view";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import type { Id, IsoDate, Project, WorkUpdate } from "@/types/domain";
import { formatLongDate, formatShortDate, today } from "@/lib/utils/date";
import { safeUrl } from "@/lib/utils/url";
import { devCopy } from "@/lib/env/app-env";
import { useZodForm } from "@/lib/validation/form";
import { projectSchema, updateSchema, workSkills, type ProjectFormValues, type UpdateFormValues } from "@/lib/validation/work";
import { useFormAction } from "@/hooks/use-form-action";
import { apiConfig } from "@/services/api/config";
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
  const { data: own } = useServiceQuery(["profile"], (s) => s.profile.getProfile(), { enabled: pathname.startsWith("/app") });
  const { data: project, isError, refetch } = useServiceQuery(["project", id], (s) => s.work.getProject(id), { keepPreviousData: false });
  const dialogs = useProjectDialogs();
  if (!project) return <QueryFeedback data={project} error={isError} retry={refetch} layout="cards" label="Loading project" />;
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
          {project.owner === own?.person.id && pathname.startsWith("/app") && (
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

export function ProjectForm({ project: initialProject }: { project: Project | null }) {
  const [project] = useState(initialProject);
  const pathname = usePathname();
  const setDirty = useModalStore((s) => s.setDirty);
  const dialogs = useProjectDialogs();
  const [error, setError] = useState("");
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const action = useFormAction((fields) => { setServerErrors(fields); setError(fields._form ?? Object.values(fields).join(" ")); });
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
    const skills = workSkills(v.skills);
    if (!skills.length) {
      toast("Add at least one skill.");
      return;
    }
    let persisted = false;
    const ok = await action.execute(async (s) => { const result = await s.work.saveProject({ id: project?.id, version: project?.version, title: v.title, category: v.category, description: v.description, contribution: v.contribution, skills, url: v.url, repository: v.repository, start: v.start, date: v.date, visibility: v.visibility, featured: v.featured, coverFile: v.coverFile?.[0] ?? null }); if (!result.ok) throw new Error(result.error); persisted = result.persisted; });
    if (!ok) return;
    toast(persisted ? "Project saved to your profile and portfolio." : STORAGE_FALLBACK);
    modal.close();
  });

  return (
    <form id="project-form" className="stack" noValidate onSubmit={submit} onInput={() => pathname === "/app/profile" && setDirty(true)}>
      <div className="grid cols2">
        <TextField label="Project title" required maxLength={120} {...register("title")} error={form.formState.errors.title?.message ?? serverErrors.title} />
        <SelectField label="Discipline" options={["Design", "Engineering", "Data", "Business"]} {...register("category")} error={form.formState.errors.category?.message ?? serverErrors.category} />
      </div>
      <TextAreaField label="Project overview" required maxLength={2000} {...register("description")} error={form.formState.errors.description?.message ?? serverErrors.description} />
      <TextAreaField label="Your role & contribution" required maxLength={1200} {...register("contribution")} error={form.formState.errors.contribution?.message ?? serverErrors.contribution} />
      <TextField label="Skills & technologies (comma separated)" required {...register("skills")} error={form.formState.errors.skills?.message ?? serverErrors.skills} />
      <FileField label="Project cover image (optional)" id="project-cover" accept="image/png,image/jpeg,image/webp" hint={devCopy("PNG, JPEG, or WebP up to 1 MB. Kept in local browser storage.", "PNG, JPEG, or WebP up to 1 MB.")} {...register("coverFile")} />
      <div className="grid cols2">
        <TextField label="Project URL" type="url" {...register("url")} error={form.formState.errors.url?.message ?? serverErrors.url} />
        <TextField label="Repository URL" type="url" {...register("repository")} error={form.formState.errors.repository?.message ?? serverErrors.repository} />
        <TextField label="Start date" type="date" required max={today()} {...register("start")} error={form.formState.errors.start?.message ?? serverErrors.start} />
        <TextField label="Completion date" type="date" required max={today()} {...register("date")} error={form.formState.errors.date?.message ?? serverErrors.date} />
        <SelectField label="Visibility" options={["Public", "Private"]} {...register("visibility")} error={form.formState.errors.visibility?.message ?? serverErrors.visibility} />
      </div>
      <CheckRow {...register("featured")}>Feature this project in my portfolio</CheckRow>
      <div id="project-error">
        <FormError message={error} />
        {Object.entries(form.formState.errors).map(([key, value]) => value?.message && <p className="error" role="alert" key={key}>{String(value.message)}</p>)}
        {Object.entries(serverErrors).filter(([key]) => key !== "_form").map(([key, message]) => <p className="error" role="alert" key={key}>{message}</p>)}
      </div>
      <div className="modal-footer">
        {project && (
          <Button variant="danger sm" icon="trash" onClick={() => dialogs.remove(project.id)}>
            Delete project
          </Button>
        )}
        <Button onClick={() => modal.requestClose()}>Cancel</Button>
        <Button type="submit" variant="primary" icon="check" loading={action.pending || form.formState.isSubmitting} disabled={action.pending || form.formState.isSubmitting}>
          Save project
        </Button>
      </div>
    </form>
  );
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
  const edit = useCallback(async (id?: Id) => {
    if (!id) {
      modal.show("Bring a project to life", <ProjectForm project={null} />, "project");
      return;
    }
    const project = await run((s) => s.work.getProject(id), { refresh: false });
    if (project) modal.show("Edit your project", <ProjectForm project={project} />, "project");
  }, [run]);
  const remove = useCallback(
    (id: Id) =>
      confirmAction("Delete this project?", "It will be removed from your profile and portfolio. Related updates will remain.", async () => {
        const ok = await run(async (s) => { await s.work.deleteProject(id); return true; });
        if (!ok) return;
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
  const { data: settings } = useServiceQuery(["settings"], (s) => s.workspace.getSettings(), { enabled: apiConfig.dataSource === "mock" });
  const { data: projects } = useServiceQuery(["projects", "me", "all"], (s) => s.work.listProjects({ ownerId: "me" }));
  if ((!settings && apiConfig.dataSource === "mock") || !projects) return null;
  return <UpdateFormFields update={update} defaultVisibility={settings?.updatesPublic ? "Public" : "Private"} projects={projects} />;
}

export function UpdateFormFields({ update: initialUpdate, defaultVisibility, projects }: { update: WorkUpdate | null; defaultVisibility: "Public" | "Private"; projects: Project[] }) {
  const [update] = useState(initialUpdate);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const action = useFormAction(setErrors);
  const form = useZodForm(updateSchema, {
    title: update?.title ?? "",
    description: update?.description ?? "",
    category: (update?.category as UpdateFormValues["category"]) ?? "Design",
    date: update?.date ?? today(),
    skills: update?.skills.join(", ") ?? "",
    project: update?.project ?? "",
    visibility: update?.visibility ?? defaultVisibility,
  } satisfies UpdateFormValues);
  const { register, handleSubmit } = form;
  const submit = handleSubmit(async (v) => {
    const project = projects.find((p) => p.id === v.project);
    if (v.project && (!project || v.visibility === "Public" && project.visibility !== "Public")) { setErrors({ project: "Choose an available public project, or keep this update private." }); return; }
    const ok = await action.execute((s) => s.work.saveUpdate({ id: update?.id, version: update?.version, title: v.title, description: v.description, category: v.category, date: v.date, skills: workSkills(v.skills), project: v.project, visibility: v.visibility }));
    if (!ok) return;
    toast("Work update saved. Your Work Pulse is up to date.");
    modal.close();
  });
  return (
    <form id="update-form" className="stack" noValidate onSubmit={submit}>
      <TextField label="Update title" required maxLength={150} placeholder="What did you work on?" {...register("title")} error={form.formState.errors.title?.message ?? errors.title} />
      <TextAreaField label="The story behind it" required maxLength={2000} placeholder="What did you make, learn, or move forward?" {...register("description")} error={form.formState.errors.description?.message ?? errors.description} />
      <div className="grid cols2">
        <SelectField label="Category" options={["Design", "Development", "Research", "Learning", "Marketing", "Collaboration"]} {...register("category")} error={form.formState.errors.category?.message ?? errors.category} />
        <TextField label="Date" type="date" required max={today()} {...register("date")} error={form.formState.errors.date?.message ?? errors.date} />
      </div>
      <TextField label="Skills (comma separated)" required {...register("skills")} error={form.formState.errors.skills?.message ?? errors.skills} />
      <SelectField label="Related project" options={[{ label: "No related project", value: "" }, ...projects.map((p) => ({ label: p.title, value: p.id }))]} {...register("project")} error={form.formState.errors.project?.message ?? errors.project} />
      <SelectField label="Visibility" options={["Public", "Private"]} {...register("visibility")} error={form.formState.errors.visibility?.message ?? errors.visibility} />
      {Object.entries(form.formState.errors).map(([key, value]) => value?.message && <p className="error" role="alert" key={key}>{String(value.message)}</p>)}
      {Object.entries(errors).map(([key, message]) => <p className="error" role="alert" key={key}>{message}</p>)}
      <div className="modal-footer">
        <Button onClick={() => modal.close()}>Cancel</Button>
        <Button type="submit" variant="primary" icon="check" disabled={action.pending || form.formState.isSubmitting}>
          {update ? "Save update" : "Publish update"}
        </Button>
      </div>
    </form>
  );
}

function UpdateDetails({ id }: { id: Id }) {
  const { data: update, isError, refetch } = useServiceQuery(["update", id], (s) => s.work.getUpdate(id), { keepPreviousData: false });
  const { data: project } = useServiceQuery(["project", update?.project], (s) => s.work.getProject(update!.project), { enabled: !!update?.project });
  const projects = useProjectDialogs();
  if (!update) return <QueryFeedback data={update} error={isError} retry={refetch} label="Loading update" />;
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
  const { data, isError, refetch } = useServiceQuery(["updates", ownerId, date, inWorkspace], (s) => s.work.listUpdates(ownerId, { date, publicOnly: !inWorkspace }), { keepPreviousData: false });
  const dialogs = useUpdateDialogs();
  if (!data) return <QueryFeedback data={data} error={isError} retry={refetch} label="Loading recorded updates" />;
  return data.length ? (
    <>
      {data.map((u) => (
        <UpdateItem key={u.id} update={u} manage={inWorkspace && ownerId === "me"} />
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
    edit: async (id: Id) => { const update = await run((s) => s.work.getUpdate(id), { refresh: false }); if (update) modal.show("Edit work update", <UpdateForm update={update} />); },
    view: async (id: Id) => {
      const u = await services.work.getUpdate(id);
      if (u) modal.show(u.title, <UpdateDetails id={id} />);
    },
    remove: (id: Id) =>
      confirmAction("Delete this update?", devCopy("It will be removed from your feed and Work Pulse in this browser.", "It will be removed from your feed and Work Pulse."), async () => {
        const ok = await run(async (s) => { await s.work.deleteUpdate(id); return true; });
        if (!ok) return;
        modal.close();
        toast("Update removed. Your Work Pulse is up to date.");
      }),
    day: (ownerId: Id, date: IsoDate) => modal.show(formatLongDate(date), <PulseDay ownerId={ownerId} date={date} />),
  };
}
