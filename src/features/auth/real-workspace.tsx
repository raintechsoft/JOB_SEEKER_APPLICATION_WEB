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
import { Brand, Button } from "@/components/ui/primitives";
import { TextField, SelectField } from "@/components/ui/field";
import { useAuthForm } from "./use-auth-form";
import { AuthError } from "./auth-errors";
import { clearIdentityState } from "./clear-identity-state";
import { authDestination } from "./auth-navigation";

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
    <SelectField label="Invitation role" options={roleOptions} {...register("role")} error={errors.role?.message} />
    <AuthError name="invite-root" message={errors.root?.message} />
    <button className="btn primary" disabled={isSubmitting}>{isSubmitting ? "Please wait…" : "Invite member"}</button>
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
    <SelectField label={`Role for ${member.name}`} options={roleOptions} {...register("role")} error={errors.role?.message} />
    <SelectField label={`Status for ${member.name}`} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} {...register("status")} error={errors.status?.message} />
    <AuthError name={`member-root-${member.id}`} message={errors.root?.message} />
    <button className="btn" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save access"}</button>
    {saved && <p role="status">Access updated.</p>}
  </form>;
}

function OrganizationAccessPanel({ workspace }: { workspace: Workspace }) {
  const organization = workspace.organization!;
  const query = useServiceQuery(["auth", "organization", organization.id], (s) => s.auth.organization(organization.id));
  if (query.isError) return <p role="alert">{errorMessage(query.error)}</p>;
  if (!query.data) return <p>Loading organization access…</p>;
  return <>
    <section className="card"><h2>{query.data.name}</h2><p>Your role: {roleOptions.find((option) => option.value === workspace.role)?.label}</p></section>
    {workspace.role === "organization_admin" && <>
      <section className="card"><InviteMemberForm organization={organization.id} /></section>
      <section aria-label="Team access"><h2>Team access</h2>{query.data.members.map((member) => <MemberAccessForm key={`${member.id}-${member.role}-${member.status}`} organization={organization.id} member={member} />)}</section>
    </>}
  </>;
}

/** Real-mode boundary: unconnected prototype screens never mount and never read the demo database. */
export function RealWorkspace({ role }: { role: "professional" | "recruiter" }) {
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
    if (query.error instanceof ApiError && query.error.status === 401) router.replace("/login");
    if (session && !session.user.email_verified) router.replace("/verify-email");
    if (home && pathname !== home) router.replace(home);
  }, [query.error, session, home, pathname, router]);
  if ((session && !session.user.email_verified) || (home && pathname !== home)) return <p role="status">Loading your workspace…</p>;
  const action = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (cause) { toast(errorMessage(cause), "error"); } finally { setBusy(false); }
  };
  return <div className={role === "recruiter" ? "professional-app recruiter-app" : "professional-app"}>
    <header className="professional-header"><div className="professional-header-inner"><Brand />
      <nav className="professional-nav" aria-label="Account workspace"><Link href={role === "professional" ? "/app/dashboard" : "/recruiter/dashboard"}>Your workspace</Link><Link href={role === "professional" ? "/app/profile" : "/recruiter/company"}>{role === "professional" ? "Your profile" : "Organization profile"}</Link><Link href="/change-password">Change password</Link></nav>
      {session && <Button disabled={busy} onClick={() => action(async () => { await auth.logout(); clearIdentityState(); cache.clear(); router.push("/login"); })}>Log out</Button>}
    </div></header>
    <main id="main" className="phase-one-workspace">
      {query.isPending ? <p>Loading your account…</p> : query.isError ? <section className="card"><p role="alert">{errorMessage(query.error)}</p><Button onClick={() => query.refetch()}>Try again</Button></section> : session && session.user.email_verified && <>
        <section className="card"><h1>Welcome, {session.user.name}</h1><p>{session.user.email}</p><p>Manage your account and organization access.</p>
          <div className="row">{session.workspaces.map((workspace) => <Button key={workspace.id} disabled={busy} onClick={() => action(async () => {
            const next = await auth.selectWorkspace(workspace.id); clearIdentityState(); cache.clear(); cache.setQueryData(["auth", "session"], next);
            router.push(workspace.kind === "professional" ? "/app/dashboard" : "/recruiter/dashboard");
          })}>{workspace.organization?.name ?? "Professional workspace"}</Button>)}</div>
        </section>
        {!selected ? <section className="card"><p>You do not have access to this workspace. An organization administrator can invite you using your verified email.</p></section> : selected.kind === "recruiter" ? <OrganizationAccessPanel workspace={selected} /> : <section className="card"><h2>Your professional account is ready</h2><p>Additional workspace features will become available here.</p></section>}
        {!pathname.endsWith("/dashboard") && !pathname.endsWith("/account") && !pathname.endsWith("/access") && <p>This workspace feature is not available yet.</p>}
      </>}
    </main>
  </div>;
}
