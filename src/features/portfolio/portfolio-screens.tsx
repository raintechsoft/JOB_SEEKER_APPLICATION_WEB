"use client";

import { useRef } from "react";
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

const STORAGE_FALLBACK = "Saved for this page only. Browser storage is full or unavailable.";

export function PortfolioBuilderScreen() {
  const run = useServiceAction();
  const share = useSharePortfolio();
  const previewMobile = useUiStore((s) => s.previewMobile);
  const setUi = useUiStore((s) => s.setUi);
  const query = useServiceQuery(["portfolio", "p0"], (s) => s.portfolio.getPortfolio("p0"));
  const { data: projects } = useServiceQuery(["projects", "p0", "all"], (s) => s.work.listProjects({ ownerId: "p0" }));
  const formRef = useRef<HTMLFormElement>(null);

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
            <Button icon="link" onClick={() => share("p0")}>
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
                  onInput={() => {
                    if (formRef.current?.checkValidity()) void run((s) => s.portfolio.saveSettings(values()));
                  }}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const result = await run((s) => s.portfolio.saveSettings(values()));
                    if (!result) return;
                    toast(!result.ok ? "That slug belongs to another demo profile. Choose another." : result.persisted ? "Portfolio settings saved." : STORAGE_FALLBACK);
                  }}
                >
                  <TextField label="Portfolio title" name="title" defaultValue={view.config.title} required />
                  <TextField label="Headline" name="headline" defaultValue={view.config.headline} required />
                  <TextField label="URL slug" name="slug" defaultValue={view.config.slug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
                  <label className="field">
                    Accent color
                    <input name="theme" type="color" defaultValue={view.config.theme} />
                  </label>
                  <label className="check-row">
                    <input name="public" type="checkbox" defaultChecked={view.config.public} />
                    Public portfolio in demo
                  </label>
                  <button className="btn primary sm" type="submit">
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
                    <input type="checkbox" checked={s.visible} aria-label={"Show " + s.name} onChange={(e) => run((sv) => sv.portfolio.setSectionVisible(i, e.target.checked))} />
                    <span className="grow">{s.name}</span>
                    <IconButton icon="up" label={"Move " + s.name + " up"} onClick={() => run((sv) => sv.portfolio.moveSection(i, -1))} />
                    <IconButton icon="down" label={"Move " + s.name + " down"} onClick={() => run((sv) => sv.portfolio.moveSection(i, 1))} />
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
                  <PortfolioSite view={view} builder />
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
  const query = useServiceQuery(["portfolio", "p0"], (s) => s.portfolio.getPortfolio("p0"));
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
            <Button variant="primary" icon="link" onClick={() => share("p0")}>
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
  const query = useServiceQuery(["portfolio", "slug", slug], (s) => s.portfolio.getPortfolioBySlug(slug));
  return (
    <QueryView query={query}>
      {(view) =>
        !view ? (
          <main id="main" className="container section">
            <NotFoundState />
          </main>
        ) : !view.config.public ? (
          <main id="main" className="container section">
            <EmptyState title="This portfolio is private." description="Its owner has turned off visibility in this browser prototype." action={<LinkButton href="/talent">Explore talent</LinkButton>} />
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
