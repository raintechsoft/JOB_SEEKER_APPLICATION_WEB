"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useServiceQuery, useServices } from "@/hooks/use-services";
import { ApiError, errorMessage } from "@/services/api/client";
import { toast } from "@/stores/toast-store";
import type { OrganizationAccess, Workspace } from "@/services/auth/auth.service";
import { inviteMemberSchema, memberAccessSchema } from "@/lib/validation/auth";
import { Brand, Button, LinkButton } from "@/components/ui/primitives";
import { StatePanel } from "@/components/ui/state-panel";
import { ErrorState } from "@/components/ui/state-views";
import { TextField, SelectField } from "@/components/ui/field";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { useAuthForm } from "./use-auth-form";
import { AuthError } from "./auth-errors";
import { clearIdentityState } from "./clear-identity-state";
import { authDestination } from "./auth-navigation";
import {applicationSignInReturn,isApplicationWizardRoute} from "@/features/applications/application-wizard-policy";
import { RECRUITER_INVITES_ENABLED } from "@/lib/feature-flags";

const roleOptions = [
  { value: "organization_admin", label: "Organization Admin" },
  { value: "recruiter", label: "Recruiter" },
  { value: "hiring_manager", label: "Hiring Manager" },
];

function InviteMemberForm({ organization }: { organization: string }) {
  const { auth } = useServices();
  const [sent, setSent] = useState(false);
  const { props, register, submit, reset, formState: { errors, isSubmitting } } = useAuthForm(inviteMemberSchema, { email: "", role: "recruiter" as NonNullable<Workspace["role"]> });
  return <form className="stack" noValidate onInput={() => setSent(false)} onSubmit={submit(async (input) => {
    setSent(false); await auth.invite(organization, input); setSent(true); reset();
  })}>
    <h2>Invite a team member</h2>
    <TextField label="Work email" type="email" required {...props("email")} />
    <AuthError name="email" message={errors.email?.message} />
    <SelectField required label="Invitation role" options={roleOptions} {...register("role")} error={errors.role?.message} />
    <AuthError name="invite-root" message={errors.root?.message} />
    <Button type="submit" variant="primary" loading={isSubmitting} loadingLabel="Sending invitation">Invite member</Button>
    {sent && <p role="status">Invitation queued for delivery.</p>}
  </form>;
}

function MemberAccessForm({ organization, member }: { organization: string; member: OrganizationAccess["members"][number] }) {
  const { auth } = useServices();
  const cache = useQueryClient();
  const [saved, setSaved] = useState(false);
  const { register, submit, formState: { errors, isSubmitting } } = useAuthForm(memberAccessSchema, { role: member.role, status: member.status });
  return <form className="card stack" noValidate onChange={() => setSaved(false)} onSubmit={submit(async (input) => {
    setSaved(false); await auth.updateMember(organization, member.id, input);
    setSaved(true); await cache.invalidateQueries({ queryKey: ["auth"] });
  })}>
    <h3>{member.name}</h3><p>{member.email}</p>
    <SelectField required label={`Role for ${member.name}`} options={roleOptions} {...register("role")} error={errors.role?.message} />
    <SelectField required label={`Status for ${member.name}`} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} {...register("status")} error={errors.status?.message} />
    <AuthError name={`member-root-${member.id}`} message={errors.root?.message} />
    <Button type="submit" loading={isSubmitting} loadingLabel="Saving access">Save access</Button>
    {saved && <p role="status">Access updated.</p>}
  </form>;
}

function OrganizationAccessPanel({ workspace }: { workspace: Workspace }) {
  const organization = workspace.organization!;
  const query = useServiceQuery(["auth", "organization", organization.id], (s) => s.auth.organization(organization.id));
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} title="Organization access couldn’t load" description="Something interrupted the request. Please try again." />;
  if (!query.data) return <ContentSkeleton layout="form" label="Loading organization access" />;
  return <>
    <section className="card"><h2>{query.data.name}</h2><p>Your role: {roleOptions.find((option) => option.value === workspace.role)?.label}</p></section>
    {workspace.role === "organization_admin" && <>
      {RECRUITER_INVITES_ENABLED && <section className="card"><InviteMemberForm organization={organization.id} /></section>}
      <section aria-label="Team access"><h2>Team access</h2>{query.data.members.map((member) => <MemberAccessForm key={`${member.id}-${member.role}-${member.status}`} organization={organization.id} member={member} />)}</section>
    </>}
  </>;
}

/** Real-mode boundary: unconnected prototype screens never mount and never read the demo database. */
/** `embedded` renders only the account content inside the workspace shell (account/access pages). */
export function RealWorkspace({ role, embedded = false }: { role: "professional" | "recruiter"; embedded?: boolean }) {
  const { auth } = useServices();
  const router = useRouter();
  const pathname = usePathname();
  const cache = useQueryClient();
  const query = useServiceQuery(["auth", "session"], (s) => s.auth.me());
  const [busy, setBusy] = useState(false);
  const session = query.data;
  const available = session?.workspaces.filter((w) => w.kind === role) ?? [];
  const selected = available.find((w) => w.id === session?.selected_identity_id) ?? available[0];
  const home = session?.user.email_verified && available.length === 0 ? authDestination(session) : null;
  useEffect(() => {
    const next=isApplicationWizardRoute(pathname)?applicationSignInReturn(window.location.pathname+window.location.search):null;
    if (query.error instanceof ApiError && query.error.status === 401) router.replace("/login"+(next?"?next="+encodeURIComponent(next):""));
    if (session && !session.user.email_verified) router.replace("/verify-email"+(next?"?next="+encodeURIComponent(next):""));
    if (home && pathname !== home) router.replace(home);
  }, [query.error, session, home, pathname, router]);
  if ((session && !session.user.email_verified) || (home && pathname !== home)) return <div className="container section" role="status" aria-label="Opening your account" aria-busy="true"><span className="sr-only">Opening your account</span></div>;
  const action = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (cause) { toast(errorMessage(cause), "error"); } finally { setBusy(false); }
  };
  const signOut = () => action(async () => { await auth.logout(); clearIdentityState(); cache.clear(); router.push("/login"); });
  const dashboard = role === "professional" ? "/app/dashboard" : "/recruiter/dashboard";
  const content = query.isPending ? <ContentSkeleton layout="profile" label="Loading your account" /> : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} title="We couldn’t load your account" description="Something interrupted the request. Please try again." /> : session && session.user.email_verified && <>
        <section className="card"><h1>Welcome, {session.user.name}</h1><p>{session.user.email}</p><p>Manage your account and organization access.</p>
          <div className="row">{session.workspaces.map((workspace) => <Button key={workspace.id} loading={busy} disabled={busy} onClick={() => action(async () => {
            const next = await auth.selectWorkspace(workspace.id); clearIdentityState(); cache.clear(); cache.setQueryData(["auth", "session"], next);
            router.push(workspace.kind === "professional" ? "/app/dashboard" : "/recruiter/dashboard");
          })}>{workspace.organization?.name ?? "Professional workspace"}</Button>)}</div>
        </section>
        {!selected ? <StatePanel icon="lock" tone="warning" title="You don’t have access to this workspace" description={"An organization administrator can invite you using your verified email." + (session.workspaces.length ? " You can switch to one of your workspaces above or sign out." : "")} actions={<Button icon="logout" loading={busy} disabled={busy} onClick={signOut}>Sign out</Button>} /> : selected.kind === "recruiter" ? <OrganizationAccessPanel workspace={selected} /> : null}
        {!pathname.endsWith("/dashboard") && !pathname.endsWith("/account") && !pathname.endsWith("/access") && <StatePanel icon="hourglass" tone="info" title="This feature isn’t available yet" description="It’s on its way. Everything that’s ready now is on your workspace dashboard." actions={<LinkButton href={dashboard} variant="primary">Go to dashboard</LinkButton>} />}
      </>;
  if (embedded) return <div className="phase-one-workspace">{content}</div>;
  return <div className={role === "recruiter" ? "professional-app recruiter-app" : "professional-app"}>
    <header className="professional-header"><div className="professional-header-inner"><Brand href={role === "professional" ? "/app/dashboard" : "/recruiter/dashboard"} />
      <nav className="professional-nav" aria-label="Account workspace"><Link href={role === "professional" ? "/app/dashboard" : "/recruiter/dashboard"}>Your workspace</Link><Link href={role === "professional" ? "/app/profile" : "/recruiter/company"}>{role === "professional" ? "Your profile" : "Organization profile"}</Link><Link href="/change-password">Change password</Link></nav>
      {session && <Button loading={busy} disabled={busy} onClick={signOut}>Log out</Button>}
    </div></header>
    <main id="main" className="phase-one-workspace">
      {content}
    </main>
  </div>;
}
