"use client";

import { useServiceAction, useServiceQuery } from "@/hooks/use-services";
import { toast } from "@/stores/toast-store";
import { Icon, type IconName } from "@/components/ui/icon";
import { Badge, Button, EmptyState, LinkButton, PageHeading } from "@/components/ui/primitives";
import { StatCard } from "@/features/talent/recruiter-talent-screens";
import {apiConfig} from "@/services/api/config";
import {RealAdminScreen} from "./real-admin-screen";
import { TableRowsSkeleton } from "@/components/ui/skeleton";
import { QueryFeedback } from "@/components/ui/query-view";

export type AdminPage = "dashboard" | "users" | "companies" | "moderation" | "quality";

const STORAGE_FALLBACK = "Saved for this page only. Browser storage is full or unavailable.";

function Users() {
  const run = useServiceAction();
  const { data, isPending, isError, refetch } = useServiceQuery(["admin", "users"], (s) => s.admin.listProfessionals());
  return (
    <div className="card" style={{ overflow: "auto" }}>
      {isError && <QueryFeedback data={undefined} error retry={refetch} />}
      {isPending && <span className="sr-only" role="status">Loading accounts</span>}
      <table className="table" aria-busy={isPending || undefined}>
        <thead>
          <tr>
            <th>Professional</th>
            <th>Role</th>
            <th>Visibility</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {isPending && <TableRowsSkeleton columns={4} />}
          {data?.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.headline}</td>
              <td>{p.public ? "Public" : "Hidden"}</td>
              <td>
                <Button
                  variant="sm"
                  onClick={async () => {
                    const ok = await run((s) => s.admin.toggleProfessionalVisibility(p.id));
                    if (ok !== undefined) toast(ok ? "Demo profile visibility updated." : STORAGE_FALLBACK);
                  }}
                >
                  {p.public ? "Hide profile" : "Restore profile"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Companies() {
  const run = useServiceAction();
  const { data } = useServiceQuery(["admin", "companies"], (s) => s.admin.listCompanies());
  return (
    <div className="stack">
      {data?.map((c) => (
        <div className="card row between wrap" key={c.id}>
          <div>
            <h3>{c.name}</h3>
            <p className="small muted">{c.recruiter}</p>
          </div>
          <div className="row wrap">
            <Badge tone="purple">{c.status}</Badge>
            <Button
              variant="sm"
              icon="check"
              onClick={async () => {
                const ok = await run((s) => s.admin.markCompanyVerified(c.id));
                if (ok !== undefined) toast(ok ? "Sample status updated. No real company was verified." : STORAGE_FALLBACK);
              }}
            >
              Mark demo verified
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

const CARDS: [string, string, string, IconName][] = [
  ["Users", "Manage sample professional visibility.", "/admin/users", "users"],
  ["Companies", "Review illustrative verification statuses.", "/admin/companies", "building"],
  ["Moderation", "Explore the sample report queue.", "/admin/moderation", "shield"],
];

function Overview() {
  const { data, isError, refetch } = useServiceQuery(["admin", "overview"], (s) => s.admin.getOverview());
  return (
    <>
      <div className="stats">
        <StatCard label="Professionals" loading={!data && !isError} value={data?.professionals ?? "—"} description="Fictional demo users" icon="users" />
        <StatCard label="Companies" loading={!data && !isError} value={data?.companies ?? "—"} description="Sample organizations" icon="building" />
        <StatCard label="Pending verification" loading={!data && !isError} value={data?.pendingVerification ?? "—"} description="Demo review requests" icon="shield" />
        <StatCard label="Reported content" loading={!data && !isError} value={data?.reportedContent ?? "—"} description="Sample moderation queue" icon="file" />
      </div>
      {isError && <QueryFeedback data={undefined} error retry={refetch} />}
      <div className="grid cols3">
        {CARDS.map(([title, description, href, icon]) => (
          <div className="card" key={title}>
            <h3>
              <Icon name={icon} /> {title}
            </h3>
            <p className="small muted" style={{ margin: "16px 0" }}>
              {description}
            </p>
            <LinkButton href={href} icon="arrow">
              Open {title.toLowerCase()}
            </LinkButton>
          </div>
        ))}
      </div>
    </>
  );
}

/** Optional administration demo. No real users or companies are managed. */
export function AdminScreen({ page }: { page: AdminPage }) {
  if(apiConfig.dataSource==="http")return <RealAdminScreen page={page}/>;
  return (
    <>
      <PageHeading title="A little platform perspective." subtitle="A lightweight administrative demo. No real users or companies are managed here." />
      {page === "quality" ? <EmptyState title="Recommendation quality uses live data." description="Served lists and what people did with them are measured by the backend. Switch to the API data source to see them." /> : page === "users" ? <Users /> : page === "companies" ? <Companies /> : page === "moderation" ? <EmptyState title="The demo queue is clear." description="No reported content in the seeded dataset." /> : <Overview />}
    </>
  );
}
