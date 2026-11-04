"use client";

import { QueryFeedback } from "@/components/ui/query-view";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Discipline, Visibility } from "@/types/domain";
import { track } from "@/lib/analytics";
import { useServiceQuery } from "@/hooks/use-services";
import { Icon, type IconName } from "@/components/ui/icon";
import { Button, EmptyState, LinkButton, PageHeading } from "@/components/ui/primitives";
import { FloatingInput } from "@/components/ui/field";
import { ProjectCard } from "@/components/work/project-card";
import { PulseCard, UpdateItem } from "@/components/work/pulse";
import { useProjectDialogs, useUpdateDialogs } from "./dialogs";

const CATEGORIES: Discipline[] = ["Design", "Engineering", "Data", "Business"];
const CATEGORY_ICONS: Record<string, IconName> = { "": "folder", Design: "edit", Engineering: "monitor", Data: "grid", Business: "briefcase" };
const VISIBILITY_OPTIONS = [
  { value: "", label: "All visibility" },
  { value: "Public", label: "Public" },
  { value: "Private", label: "Private" },
] as const;

function projectsHref(params: { category?: string; q?: string; visibility?: string }) {
  const next = new URLSearchParams();
  if (params.category) next.set("category", params.category);
  if (params.q) next.set("q", params.q);
  if (params.visibility) next.set("visibility", params.visibility);
  return "/app/projects" + (next.size ? "?" + next : "");
}

/** Compact ⋯ menu for All / Design / Engineering / Data / Business on small screens. */
function ProjectsCategoryMenu({
  category,
  counts,
  q,
  visibility,
}: {
  category: string;
  counts: Record<string, number>;
  q: string;
  visibility: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className={"projects-section-menu" + (open ? " is-open" : "")} ref={root}>
      <button type="button" className="iconbtn projects-section-trigger" aria-label="Project categories" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((value) => !value)}>
        <Icon name="more" />
      </button>
      <div className="projects-section-menu-list" role="menu" aria-label="Project categories">
        {["", ...CATEGORIES].map((c) => {
          const count = counts[c] ?? 0;
          return (
            <Link
              key={c || "all"}
              href={projectsHref({ category: c, q, visibility })}
              role="menuitem"
              className={category === c ? "active" : undefined}
              aria-current={category === c ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon name={CATEGORY_ICONS[c]} />
              <span>{c || "All projects"}</span>
              {count > 0 && <span className="projects-section-menu-count">{count}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function VisibilityDropdown({
  value,
  variant = "pill",
  category,
  q,
}: {
  value: string;
  variant?: "pill" | "icon";
  category?: string;
  q?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const id = useId();
  const label = VISIBILITY_OPTIONS.find((option) => option.value === selected)?.label ?? "All visibility";
  const apply = (next: string) => {
    setSelected(next);
    setOpen(false);
    trigger.current?.focus();
    if (variant === "icon") {
      router.push(projectsHref({ category, q, visibility: next }));
    }
  };
  useEffect(() => {
    setSelected(value);
  }, [value]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div
      className={"application-stage-dropdown projects-visibility-dropdown" + (variant === "icon" ? " is-icon" : "") + (open ? " is-open" : "") + (selected ? " has-filter" : "")}
      ref={root}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      {variant === "pill" ? <input type="hidden" name="visibility" value={selected} /> : null}
      <button
        ref={trigger}
        type="button"
        className={variant === "icon" ? "iconbtn projects-tool-trigger" : "application-filter-pill"}
        aria-label="Visibility filter"
        data-active={!!selected}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
      >
        {variant === "icon" ? <Icon name="eye" /> : (
          <>
            {label}
            <Icon name="chevron" />
          </>
        )}
      </button>
      {open && (
        <fieldset id={id} className={variant === "icon" ? "projects-visibility-options" : "application-stage-options"}>
          <legend className="sr-only">Visibility</legend>
          <p>Select visibility</p>
          {VISIBILITY_OPTIONS.map((option) => (
            <label
              key={option.label}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                apply(option.value);
              }}
            >
              <span>{option.label}</span>
              <input
                type="radio"
                name={id}
                value={option.value}
                checked={selected === option.value}
                onChange={() => apply(option.value)}
              />
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}

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
  const categoryCounts = Object.fromEntries(
    ["", ...CATEGORIES].map((c) => [c, all ? (c ? all.filter((p) => p.category === c).length : all.length) : 0]),
  ) as Record<string, number>;
  const categoryLink = (c: string) => projectsHref({ category: c, q, visibility });
  return (
    <div className="projects-workspace">
      <PageHeading
        title="Projects"
        subtitle=""
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
              const count = categoryCounts[c] ?? 0;
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
            <div className="projects-content-title-row">
              <h2>{category ? category + " projects" : "All projects"}</h2>
              <div className="projects-mobile-tools">
                <VisibilityDropdown variant="icon" value={visibility} category={category} q={q} />
                <ProjectsCategoryMenu category={category} counts={categoryCounts} q={q} visibility={visibility} />
              </div>
            </div>
            <span className="projects-sort-label">Newest first</span>
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
              <FloatingInput compact label="Search your projects" type="search" name="q" maxLength={200} defaultValue={q} placeholder="Search projects or skills..." aria-label="Search your projects" />
            </label>
            <VisibilityDropdown value={visibility} />
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
          <QueryFeedback data={list} error={filtered ? listQuery.isError : allQuery.isError} cause={filtered ? listQuery.error : allQuery.error} retry={() => filtered ? listQuery.refetch() : allQuery.refetch()} layout="cards" label="Loading projects" />
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
                    icon={filtered ? "search" : "folder"}
                    title={filtered ? "No matching projects" : "Your next project belongs here"}
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
  const updates = useUpdateDialogs();
  const { data, isError, error, refetch } = useServiceQuery(["updates", "me", "latest"], (s) => s.work.listUpdates("me", { limit: 5 }));
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
        <PulseCard ownerId="me" />
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Behind the activity</h2>
              <p>Select any day in your Work Pulse to explore the details.</p>
            </div>
          </div>
          <QueryFeedback data={data} error={isError} cause={error} compact retry={refetch} label="Loading recent updates" />
          {data?.length === 0 && <EmptyState compact icon="pulse" title="No updates yet" description="Your recent updates will appear here. Record what you worked on today to start your Work Pulse." action={<Button variant="primary sm" icon="plus" onClick={updates.create}>Record an update</Button>} />}
          {data?.map((u) => (
            <UpdateItem key={u.id} update={u} manage />
          ))}
        </section>
      </div>
    </>
  );
}
