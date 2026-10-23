"use client";

import { QueryFeedback } from "@/components/ui/query-view";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Discipline, Visibility } from "@/types/domain";
import { track } from "@/lib/analytics";
import { useServiceQuery } from "@/hooks/use-services";
import { useUiStore } from "@/stores/ui-store";
import { Icon, type IconName } from "@/components/ui/icon";
import { Button, EmptyState, LinkButton, PageHeading } from "@/components/ui/primitives";
import { FloatingInput, SelectField } from "@/components/ui/field";
import { ProjectCard } from "@/components/work/project-card";
import { PulseCard, UpdateItem } from "@/components/work/pulse";
import { useProjectDialogs, useUpdateDialogs } from "./dialogs";

const CATEGORIES: Discipline[] = ["Design", "Engineering", "Data", "Business"];
const CATEGORY_ICONS: Record<string, IconName> = { "": "folder", Design: "edit", Engineering: "monitor", Data: "grid", Business: "briefcase" };

export function ProjectsScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const dialogs = useProjectDialogs();
  const category = CATEGORIES.includes(params.get("category") as Discipline) ? (params.get("category") as Discipline) : "";
  const q = params.get("q") || "";
  const visibility = ["Public", "Private"].includes(params.get("visibility") || "") ? (params.get("visibility") as Visibility) : "";
  const filtered = !!(category || q || visibility);
  const allQuery = useServiceQuery(["projects", "me", "all"], (s) => s.work.listProjects({ ownerId: "me" }));
  const listQuery = useServiceQuery(["projects", "me", category, visibility, q], (s) => s.work.listProjects({ ownerId: "me", category, visibility, q }), { enabled: filtered });
  const all = allQuery.data, list = filtered ? listQuery.data : allQuery.data;
  const categoryLink = (c: string) => {
    const next = new URLSearchParams(params);
    if (c) next.set("category", c);
    else next.delete("category");
    return "/app/projects" + (next.size ? "?" + next : "");
  };
  return (
    <div className="projects-workspace">
      <PageHeading
        title="Projects"
        subtitle="A home for the projects that show what you can do."
        actions={
          <Button variant="primary" icon="plus" onClick={dialogs.create}>
            Add project
          </Button>
        }
      />
      <div className="application-layout projects-layout">
        <aside className="card application-sidebar projects-sidebar">
          <h2>Your projects</h2>
          <nav aria-label="Project categories">
            {["", ...CATEGORIES].map((c) => {
              const count = all ? (c ? all.filter((p) => p.category === c).length : all.length) : 0;
              return (
                <Link key={c || "all"} href={categoryLink(c)} className={category === c ? "active" : ""} aria-current={category === c ? "page" : undefined}>
                  <span className="application-section-label">
                    <Icon name={CATEGORY_ICONS[c]} />
                    <span>{c || "All projects"}</span>
                  </span>
                  {count > 0 && <span className="application-section-count">{count}</span>}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="projects-content">
          <div className="projects-content-heading">
            <h2>{category ? category + " projects" : "All projects"}</h2>
            <span>Newest first</span>
          </div>
          <form
            id="projects-search-form"
            className="card projects-filters"
            key={category + q + visibility}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const next = new URLSearchParams();
              for (const k of ["category", "q", "visibility"]) {
                const v = String(f.get(k) || "").trim();
                if (v) next.set(k, v);
              }
              track("search_performed", { surface: "projects", hasQuery: !!next.get("q") });
              router.push(pathname + (next.size ? "?" + next : ""));
            }}
          >
            <input type="hidden" name="category" value={category} />
            <label className="projects-search">
              <Icon name="search" />
              <FloatingInput label="Search your projects" type="search" name="q" maxLength={200} defaultValue={q} placeholder="Search projects or skills..." aria-label="Search your projects" />
            </label>
            <SelectField label="Visibility" name="visibility" defaultValue={visibility} options={[{ value: "", label: "All visibility" }, "Public", "Private"]} />
            <button type="submit" className="btn sm search-button">
              <Icon name="search" />
              Search
            </button>
            {filtered && (
              <LinkButton href="/app/projects" variant="text sm" icon="close">
                Clear
              </LinkButton>
            )}
          </form>
          <QueryFeedback data={list} error={filtered ? listQuery.isError : allQuery.isError} retry={() => filtered ? listQuery.refetch() : allQuery.refetch()} layout="cards" label="Loading projects" />
          {list && (
            <>
              <p className="projects-result-count" role="status">
                {list.length} {list.length === 1 ? "project" : "projects"}
                {filtered ? " matching your filters" : ""}
              </p>
              <section className="project-record-grid" aria-label="Your projects">
                {list.length ? (
                  list.map((p) => <ProjectCard key={p.id} project={p} manage />)
                ) : (
                  <EmptyState
                    title={filtered ? "No matching projects." : "Your next project belongs here."}
                    description={filtered ? "Try another category, visibility, or search term." : "Share your contribution, process, and outcome."}
                    action={
                      filtered ? (
                        <LinkButton href="/app/projects" icon="close">
                          Clear filters
                        </LinkButton>
                      ) : (
                        <Button variant="primary" icon="plus" onClick={dialogs.create}>
                          Create a project
                        </Button>
                      )
                    }
                  />
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function WorkPulseScreen() {
  const range = useUiStore((s) => s.pulseRange);
  const setUi = useUiStore((s) => s.setUi);
  const updates = useUpdateDialogs();
  const { data, isError, refetch } = useServiceQuery(["updates", "me", "latest"], (s) => s.work.listUpdates("me", { limit: 5 }));
  return (
    <>
      <PageHeading
        title="Every little step counts."
        subtitle="A living record of the work you share, one day at a time."
        actions={
          <Button variant="primary" icon="plus" onClick={updates.create}>
            Record an update
          </Button>
        }
      />
      <div className="stack">
        <PulseCard ownerId="me" days={range} full onRangeChange={(d) => setUi({ pulseRange: d })} />
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Behind the activity</h2>
              <p>Select any day in your Work Pulse to explore the details.</p>
            </div>
          </div>
          <QueryFeedback data={data} error={isError} retry={refetch} label="Loading recent updates" />
          {data?.length === 0 && <p className="small muted">Your recent updates will appear here.</p>}
          {data?.map((u) => (
            <UpdateItem key={u.id} update={u} manage />
          ))}
        </section>
      </div>
    </>
  );
}
