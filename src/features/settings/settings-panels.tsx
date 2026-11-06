"use client";

import { useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { InfoBadge } from "@/components/ui/info-badge";
import { QueryFeedback } from "@/components/ui/query-view";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { clearIdentityState } from "@/features/auth/clear-identity-state";
import { PreferenceEditor } from "@/features/profile/profile-forms";
import { apiConfig } from "@/services/api/config";
import type { SettingKey } from "@/services/workspace/workspace.service";
import { useServiceAction, useServiceQuery, useServices } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { ApiError, errorMessage } from "@/services/api/client";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { Button, LinkButton } from "@/components/ui/primitives";
import { confirmAction, ScreenError } from "@/components/ui/feedback";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { resetOrganizationDrafts } from "@/features/organization/draft-store";
import { profileSectionSchema } from "@/lib/validation/profile";
import { recruiterSchema } from "@/lib/validation/organization";
import type { ProfileView } from "@/services/profile/profile.service";
import type { RecruiterMember, Role } from "@/types/domain";
import { portfolioUiEnabled } from "@/features/portfolio/portfolio-ui-policy";
import { TEAM_WORKSPACE_ACCESS_ENABLED } from "@/lib/feature-flags";
import { AnalyticsPreference } from "./analytics-preference";
import { BlockedAccounts } from "./blocked-accounts";
import { NotificationPreferences } from "./notification-preferences";
import { OrganizationContactSettings } from "./organization-contact-settings";
import { PersonalizationDataActions, PersonalizationPreference } from "./personalization-preference";
import { SettingsLinkCard } from "./settings-link-card";
import type { SettingsSectionId } from "./settings-catalog";

const COMMUNICATION_OPTIONS = ["Messages on Skillora", "Application follow-up only", "Not open to inquiries"] as const;
const VISIBILITY_OPTIONS = ["Public", "Hidden"] as const;

function SwitchRow({ title, description, checked, disabled, onChange }: { title: string; description?: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="settings-row">
      <div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <label className="switch">
        <input type="checkbox" checked={checked} disabled={disabled} aria-label={title} onChange={(event) => onChange(event.target.checked)} />
        <span />
      </label>
    </div>
  );
}

function SelectRow({ title, description, value, options, disabled, onChange }: { title: string; description?: string; value: string; options: readonly string[]; disabled?: boolean; onChange: (value: string) => void }) {
  return (
    <div className="settings-row is-select">
      <div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <select className="settings-select" aria-label={title} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function identityPrivacyValues(profile: ProfileView, patch: { publicEmail?: boolean; publicPhone?: boolean }) {
  const { person, details } = profile;
  return {
    name: person.name,
    headline: person.headline,
    location: person.location,
    years: String(person.years ?? 0),
    email: person.email,
    phone: details.phone,
    currentTitle: details.currentTitle,
    currentCompany: details.currentCompany,
    employmentStatus: details.employmentStatus,
    available: person.available,
    public: person.public,
    publicEmail: patch.publicEmail ?? details.privacy.email,
    publicPhone: patch.publicPhone ?? details.privacy.phone,
  };
}

function AccountPanel({ role }: { role: Role }) {
  const run = useServiceAction();
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const cache = useQueryClient();
  const setUi = useUiStore((s) => s.setUi);
  const setOnboarding = useUiStore((s) => s.setOnboarding);
  const professional = role === "professional";
  const settings = useServiceQuery(["settings"], (s) => s.workspace.getSettings(), { enabled: professional });
  const recruiter = useServiceQuery(["shell", "recruiter"], (s) => s.workspace.getRecruiterShell(), { enabled: !professional });
  const name = professional ? settings.data?.name : recruiter.data?.identity.name;
  const email = professional ? settings.data?.email : recruiter.data?.email;
  const loaded = professional ? settings.data : recruiter.data;
  const failed = professional ? settings.isError && !settings.data : recruiter.isError && !recruiter.data;
  const error = professional ? settings.error : recruiter.error;
  const refetch = professional ? settings.refetch : recruiter.refetch;
  const reset = () =>
    confirmAction(
      "Start the demo fresh?",
      "This clears your local edits, projects, shortlists, and messages and restores all sample content.",
      async () => {
        await run((s) => s.workspace.resetDemo());
        resetOrganizationDrafts();
        setUi({ shortlistTab: "s0", compared: ["p0", "p3"] });
        setOnboarding({ step: 0, cvName: "", cvParsed: false });
        modal.close();
        toast("All sample content restored.");
      },
      "Reset demo",
    );
  const logout = async () => {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    const ok = await run(async (s) => {
      await s.workspace.signOut();
      return true;
    }, { refresh: false });
    locked.current = false;
    setPending(false);
    if (!ok) return;
    if (apiConfig.dataSource === "http") {
      clearIdentityState();
      cache.clear();
      router.push("/login");
    } else router.push("/");
    toast(devCopy("You’ve left the demo workspace. Local changes are kept.", "You’ve signed out."));
  };
  return (
    <section className="card form-card account-card">
      <h2>{devCopy("Demo account", "Account")}</h2>
      {failed ? <ScreenError compact error={error} title="Account details couldn’t load" description="Your saved details haven’t changed. Please try again." onRetry={() => void refetch()} /> : null}
      <div className="settings-row">
        <div className="account-identity">
          {loaded ? (
            <>
              <h3>{name}</h3>
              <p>{email} · {professional ? devCopy("Professional demo account", "Professional account") : "Recruiter account"}</p>
            </>
          ) : (
            <LoadingRegion label="Loading account details">
              <Skeleton style={{ width: 160, height: 18, display: "block", marginBottom: 8 }} />
              <Skeleton style={{ width: 240, height: 14, display: "block" }} />
            </LoadingRegion>
          )}
        </div>
        <LinkButton href={professional ? "/app/profile" : "/recruiter/profile"} variant="sm" icon="edit" aria-label="Edit profile" />
      </div>
      {TEAM_WORKSPACE_ACCESS_ENABLED && apiConfig.dataSource === "http" && !professional ? (
        <SettingsLinkCard href="/recruiter/access" icon="users" title="Team and workspace access" description="Manage organization access for your team." />
      ) : null}
      <SettingsLinkCard href="/change-password" icon="lock" title="Change password" description="Update your password. You’ll be signed out of this session." />
      <DevOnly>
        <div className="settings-row">
          <div>
            <h3>Reset demo data</h3>
            <p>Remove local changes and restore the original sample profiles, projects, and messages.</p>
          </div>
          <Button variant="danger sm" icon="trash" onClick={reset}>
            Reset data
          </Button>
        </div>
      </DevOnly>
      <div className="form-actions">
        <Button variant="danger" icon="logout" disabled={pending} onClick={() => void logout()}>
          Log out
        </Button>
      </div>
    </section>
  );
}

function RecruiterPrivacyControls() {
  const services = useServices();
  const cache = useQueryClient();
  const locked = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const query = useServiceQuery(["organization"], (s) => s.organization.getContext());
  const member = query.data?.currentRecruiter;

  const saveField = async (field: "profileVisibility" | "communicationPreference", value: string) => {
    if (locked.current || !member) return;
    locked.current = true;
    setPending(field);
    try {
      const latest = await services.organization.getContext();
      const next: RecruiterMember = {
        ...latest.currentRecruiter,
        [field]: value,
      };
      if (apiConfig.dataSource === "http") {
        const checked = recruiterSchema.safeParse(next);
        if (!checked.success) {
          toast(checked.error.issues[0]?.message ?? "Please check your recruiter profile before changing this.", "error");
          return;
        }
      }
      await services.organization.saveRecruiter(next);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["organization"] }),
        cache.invalidateQueries({ queryKey: ["shell", "recruiter"] }),
        cache.invalidateQueries({ queryKey: ["recruiter"] }),
      ]);
      toast(devCopy("Preference saved in this browser.", "Preference saved."));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast("This recruiter profile changed. Reload before continuing.", "error");
        await query.refetch();
      } else {
        toast(errorMessage(error), "error");
      }
    } finally {
      locked.current = false;
      setPending(null);
    }
  };

  return (
    <section className="card form-card">
      <h2>Privacy & visibility</h2>
      {query.isError && !query.data ? (
        <ScreenError compact error={query.error} title="Privacy settings couldn’t load" description="Your saved preferences haven’t changed. Please try again." onRetry={() => void query.refetch()} />
      ) : (
        <QueryFeedback data={query.data} error={query.isError} cause={query.error} retry={query.refetch} layout="form" label="Loading privacy settings" />
      )}
      {member ? (
        <>
          <SelectRow
            title="Personal profile visibility"
            description="Show your recruiter profile publicly, or keep it hidden."
            value={member.profileVisibility}
            options={VISIBILITY_OPTIONS}
            disabled={pending !== null}
            onChange={(value) => void saveField("profileVisibility", value)}
          />
          <SelectRow
            title="Candidate communication preference"
            description="How candidates may reach you after discovering your profile."
            value={COMMUNICATION_OPTIONS.includes(member.communicationPreference as (typeof COMMUNICATION_OPTIONS)[number]) ? member.communicationPreference : COMMUNICATION_OPTIONS[0]}
            options={COMMUNICATION_OPTIONS}
            disabled={pending !== null}
            onChange={(value) => void saveField("communicationPreference", value)}
          />
        </>
      ) : null}
    </section>
  );
}

function PrivacyPanel({ role }: { role: Role }) {
  const professional = role === "professional";
  const run = useServiceAction();
  const services = useServices();
  const cache = useQueryClient();
  const locked = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const settings = useServiceQuery(["settings"], (s) => s.workspace.getSettings(), { enabled: professional });
  const profile = useServiceQuery(["profile"], (s) => s.profile.getProfile(), { enabled: professional });
  const updateSetting = async (key: SettingKey, value: boolean) => {
    if (locked.current) return;
    locked.current = true;
    setPending(key);
    const ok = await run((s) => s.workspace.updateSetting(key, value));
    locked.current = false;
    setPending(null);
    if (ok !== undefined) toast(ok ? devCopy("Preference saved in this browser.", "Preference saved.") : "Saved for this page only. Browser storage is full or unavailable.", ok ? undefined : "error");
  };
  const updateIdentityFlag = async (flag: "publicEmail" | "publicPhone", value: boolean) => {
    if (locked.current) return;
    locked.current = true;
    setPending(flag);
    try {
      const latest = await services.profile.getProfile();
      const input = identityPrivacyValues(latest, { [flag]: value });
      const checked = profileSectionSchema("identity").safeParse(input);
      if (!checked.success) {
        toast(checked.error.issues[0]?.message ?? "Please check your profile details before changing this.", "error");
        return;
      }
      const result = await services.profile.saveSection("identity", input, latest.details.revision);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      await Promise.all([cache.invalidateQueries({ queryKey: ["profile"] }), cache.invalidateQueries({ queryKey: ["settings"] }), cache.invalidateQueries({ queryKey: ["shell"] })]);
      toast(devCopy("Preference saved in this browser.", "Preference saved."));
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      locked.current = false;
      setPending(null);
    }
  };
  const rows: [string, string, SettingKey, boolean][] = settings.data
    ? [
        ["Profile visibility", "Show your public profile to anyone, including people who are signed out, and in public search.", "profile-public", settings.data.profilePublic],
        ...(portfolioUiEnabled()
          ? ([
              [
                "Portfolio visibility",
                devCopy(
                  "Allow portfolio preview through the shareable demo URL.",
                  "Allow portfolio preview through your shareable URL.",
                ),
                "portfolio-public",
                settings.data.portfolioPublic,
              ],
            ] as [string, string, SettingKey, boolean][])
          : []),
        ["Default work update visibility", "New updates start public. You can change each update individually.", "updates-public", settings.data.updatesPublic],
      ]
    : [];
  return (
    <>
      {professional ? (
        <section className="card form-card">
          <h2>Privacy & visibility</h2>
          {settings.isError && !settings.data ? <ScreenError compact error={settings.error} title="Privacy settings couldn’t load" description="Your saved preferences haven’t changed. Please try again." onRetry={() => void settings.refetch()} /> : <QueryFeedback data={settings.data} error={settings.isError} cause={settings.error} retry={settings.refetch} layout="form" label="Loading privacy settings" />}
          {settings.data?.moderationHidden ? <p role="status">Your public profile is currently hidden by platform review. Your own visibility preferences are preserved.</p> : null}
          {rows.map(([title, description, key, value]) => (
            <SwitchRow key={key} title={title} description={description} checked={value} disabled={pending !== null} onChange={(next) => void updateSetting(key, next)} />
          ))}
          {profile.isError && !profile.data ? <ScreenError compact error={profile.error} title="Contact visibility couldn’t load" description="Your saved preferences haven’t changed. Please try again." onRetry={() => void profile.refetch()} /> : null}
          {profile.data ? (
            <>
              <SwitchRow title="Show my email on public profiles" description="Include your email on public profiles and portfolio." checked={profile.data.details.privacy.email} disabled={pending !== null} onChange={(next) => void updateIdentityFlag("publicEmail", next)} />
              <SwitchRow title="Show my phone on public profiles" description="Include your phone on public profiles and portfolio." checked={profile.data.details.privacy.phone} disabled={pending !== null} onChange={(next) => void updateIdentityFlag("publicPhone", next)} />
            </>
          ) : professional ? <QueryFeedback data={profile.data} error={profile.isError} cause={profile.error} retry={profile.refetch} layout="form" label="Loading contact visibility" /> : null}
          <DevOnly>
            <InfoBadge label="Settings information" style={{ marginTop: 22 }}>
              Visibility controls demonstrate product behavior in this browser. They are not server-enforced security. Demo messages, sample analytics, CV parsing, expiry dates, and OTP are simulations.
            </InfoBadge>
          </DevOnly>
        </section>
      ) : (
        <RecruiterPrivacyControls />
      )}
      <section className="card form-card">
        <h2>Blocked accounts</h2>
        <BlockedAccounts role={role} />
      </section>
    </>
  );
}

function NotificationsPanel({ role }: { role: Role }) {
  return (
    <>
      <NotificationPreferences />
      {role === "professional" ? (
        <section className="card form-card">
          <h2>Job alerts</h2>
          <p>Delivery channels are above. Alert filters — keywords, location, and arrangement — stay in Job Tracker.</p>
          <LinkButton href="/app/applications" variant="sm">
            Manage job alerts
          </LinkButton>
        </section>
      ) : null}
    </>
  );
}

function CareerPanel() {
  const query = useServiceQuery(["profile"], (s) => s.profile.getProfile());
  return (
    <section className="card form-card">
      <h2>Career preferences</h2>
      {query.isError && !query.data ? (
        <ScreenError compact error={query.error} title="Career preferences couldn’t load" description="Your saved preferences haven’t changed. Please try again." onRetry={() => void query.refetch()} />
      ) : (
        <QueryFeedback data={query.data} error={query.isError} cause={query.error} retry={query.refetch} layout="form" label="Loading career preferences" />
      )}
      {query.data ? <PreferenceEditor section="career" details={query.data.details} /> : null}
    </section>
  );
}

function LinkPanel({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <section className="card form-card">
      <h2>{title}</h2>
      <p>{intro}</p>
      {children}
    </section>
  );
}

export function SettingsPanel({ role, section }: { role: Role; section: SettingsSectionId }) {
  if (section === "account") return <AccountPanel role={role} />;
  if (section === "privacy") return <PrivacyPanel role={role} />;
  if (section === "notifications") return <NotificationsPanel role={role} />;
  if (section === "personalisation") return <PersonalizationPreference />;
  if (section === "data") {
    return (
      <>
        <section className="card form-card">
          <h2>Your activity data</h2>
          <p>Download a copy of the activity Skillora uses for personalisation, or delete viewing and search history.</p>
          <PersonalizationDataActions />
        </section>
        <AnalyticsPreference />
      </>
    );
  }
  if (section === "career") return <CareerPanel />;
  if (section === "organization") return <OrganizationContactSettings />;
  if (section === "hiring") {
    return (
      <LinkPanel title="Hiring" intro="Talent interests live on Discover. Settings does not duplicate that editor.">
        <SettingsLinkCard href="/recruiter/discover" icon="search" title="Talent discovery interests" description="Set the roles and specializations you look for." />
      </LinkPanel>
    );
  }
  return null;
}
