"use client";

import { useEffect, useRef } from "react";
import { devCopy } from "@/lib/env/app-env";
import { useServiceAction, useServiceQuery } from "@/hooks/use-services";
import { useUiStore } from "@/stores/ui-store";
import { toast } from "@/stores/toast-store";
import { Icon } from "@/components/ui/icon";
import { Button, EmptyState, IconButton, LinkButton, PageHeading } from "@/components/ui/primitives";
import { TextField } from "@/components/ui/field";
import { QueryView } from "@/components/ui/query-view";
import { PortfolioSite } from "@/components/portfolio/portfolio-site";
import { NotFoundState } from "@/features/talent/candidate-screen";
import { useSharePortfolio } from "./share-dialog";
import { usePortfolioAutosave } from "./use-portfolio-autosave";
import { portfolioShareContext } from "@/services/work/work.http";

export function PortfolioBuilderScreen() {
  const run = useServiceAction();
  const share = useSharePortfolio();
  const previewMobile = useUiStore((s) => s.previewMobile);
  const setUi = useUiStore((s) => s.setUi);
  const query = useServiceQuery(["portfolio", "me"], (s) => s.portfolio.getPortfolio("me"));
  const { data: projects } = useServiceQuery(["projects", "me", "all"], (s) => s.work.listProjects({ ownerId: "me" }));
  const formRef = useRef<HTMLFormElement>(null);
  const autosave = usePortfolioAutosave(query.data);
  useEffect(() => { if (!autosave.dirty && !autosave.pending) formRef.current?.reset(); }, [query.data, autosave.dirty, autosave.pending]);

  const values = () => {
    const f = new FormData(formRef.current!);
    return { title: String(f.get("title") || "").trim(), headline: String(f.get("headline") || "").trim(), slug: String(f.get("slug") || "").trim(), theme: String(f.get("theme") || ""), public: f.has("public") };
  };

  return (
    <>
      <PageHeading
        title="Your work. Your own space."
        subtitle="A living portfolio, built from the story you’re already telling."
        actions={
          <>
            <Button icon="link" onClick={() => share("me")}>
              Share portfolio
            </Button>
            <LinkButton href="/app/portfolio/preview" variant="primary" icon="external">
              Full preview
            </LinkButton>
          </>
        }
      />
      <QueryView query={query}>
        {(view) =>
          view && (
            <div className="builder">
              <section className="card controls">
                <div className="card-head">
                  <h2>Make it yours</h2>
                  <Icon name="sliders" />
                </div>
                <form
                  id="portfolio-config"
                  ref={formRef}
                  className="stack"
                  style={{ gap: 15 }}
                  noValidate
                  onInput={() => autosave.schedule(values())}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await autosave.save(values())) toast("Portfolio settings saved.");
                  }}
                >
                  <TextField label="Portfolio title" name="title" defaultValue={view.config.title} required error={autosave.errors.title} maxLength={120} />
                  <TextField label="Headline" name="headline" defaultValue={view.config.headline} required error={autosave.errors.headline} maxLength={200} />
                  <TextField label="URL slug" name="slug" defaultValue={view.config.slug} required error={autosave.errors.slug} maxLength={180} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
                  <label className="field">
                    Accent color
                    <input name="theme" type="color" defaultValue={view.config.theme} />
                  </label>
                  <label className="check-row">
                    <input name="public" type="checkbox" defaultChecked={view.config.public} />
                    {devCopy("Public portfolio in demo", "Public portfolio")}
                  </label>
                  {autosave.errors._form && <p role="alert">{autosave.errors._form}</p>}
                  <p role="status">{autosave.pending ? "Saving…" : autosave.dirty ? "Unsaved changes" : "All changes saved"}</p>
                  <button className="btn primary sm" type="submit" disabled={autosave.pending}>
                    Save portfolio
                  </button>
                </form>
                <hr className="divider" />
                <h3 style={{ fontSize: 12, marginBottom: 10 }}>Your sections</h3>
                <p className="small muted" style={{ fontSize: 9, marginBottom: 8 }}>
                  Choose what to show. Use arrows to reorder.
                </p>
                {view.config.sections.map((s, i) => (
                  <div className="section-control" key={s.name}>
                    <input type="checkbox" disabled={autosave.pending || autosave.dirty} checked={s.visible} aria-label={"Show " + s.name} onChange={(e) => run((sv) => sv.portfolio.setSectionVisible(i, e.target.checked))} />
                    <span className="grow">{s.name}</span>
                    <IconButton icon="up" label={"Move " + s.name + " up"} disabled={autosave.pending || autosave.dirty || i === 0} onClick={() => run((sv) => sv.portfolio.moveSection(i, -1))} />
                    <IconButton icon="down" label={"Move " + s.name + " down"} disabled={autosave.pending || autosave.dirty || i === view.config.sections.length - 1} onClick={() => run((sv) => sv.portfolio.moveSection(i, 1))} />
                  </div>
                ))}
                <h3 style={{ fontSize: 12, margin: "20px 0 12px" }}>Featured projects</h3>
                {projects?.map((pr) => (
                  <label className="check-row" style={{ marginBottom: 12, fontSize: 10 }} key={pr.id}>
                    <input type="checkbox" checked={pr.featured} onChange={(e) => run((sv) => sv.work.setProjectFeatured(pr.id, e.target.checked))} />
                    {pr.title}
                  </label>
                ))}
              </section>
              <div>
                <div className="row between" style={{ marginBottom: 13 }}>
                  <span className="eyebrow" style={{ fontSize: 9 }}>
                    LIVE PREVIEW
                  </span>
                  <div className="row gap8">
                    <IconButton icon="monitor" label="Desktop preview" extra={previewMobile ? "" : "saved"} onClick={() => setUi({ previewMobile: false })} />
                    <IconButton icon="phone" label="Mobile preview" extra={previewMobile ? "saved" : ""} onClick={() => setUi({ previewMobile: true })} />
                  </div>
                </div>
                <div className={"builder-preview " + (previewMobile ? "mobile" : "")} id="portfolio-live">
                  <PortfolioSite view={autosave.preview ? { ...view, config: { ...view.config, ...autosave.preview } } : view} builder />
                </div>
              </div>
            </div>
          )
        }
      </QueryView>
    </>
  );
}

export function PortfolioPreviewScreen() {
  const share = useSharePortfolio();
  const query = useServiceQuery(["portfolio", "me"], (s) => s.portfolio.getPortfolio("me"));
  return (
    <>
      <PageHeading
        title="A space that feels like you."
        subtitle="This preview reflects your saved portfolio settings."
        actions={
          <>
            <Button icon="download" onClick={() => window.print()}>
              Print / save as PDF
            </Button>
            <LinkButton href="/app/portfolio" icon="edit">
              Back to builder
            </LinkButton>
            <Button variant="primary" icon="link" onClick={() => share("me")}>
              Share
            </Button>
          </>
        }
      />
      <QueryView query={query}>{(view) => view && <PortfolioSite view={view} />}</QueryView>
    </>
  );
}

export function PublicPortfolioScreen({ slug }: { slug: string }) {
  const query = useServiceQuery(["portfolio", "slug", slug, portfolioShareContext()], (s) => s.portfolio.getPortfolioBySlug(slug), { keepPreviousData: false });
  return (
    <QueryView query={query}>
      {(view) =>
        !view ? (
          <main id="main" className="container section">
            <NotFoundState />
          </main>
        ) : !view.config.public && !view.accessGranted ? (
          <main id="main" className="container section">
            <EmptyState title="This portfolio is private." description={devCopy("Its owner has turned off visibility in this browser prototype.", "Its owner has turned off visibility.")} action={<LinkButton href="/talent">Explore talent</LinkButton>} />
          </main>
        ) : (
          <main id="main" style={{ padding: "30px 16px 60px" }}>
            <PortfolioSite view={view} />
          </main>
        )
      }
    </QueryView>
  );
}
