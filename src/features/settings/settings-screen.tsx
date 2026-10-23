"use client";

import { QueryFeedback } from "@/components/ui/query-view";

import {useRef,useState} from "react";
import { useRouter } from "next/navigation";
import {useQueryClient} from "@tanstack/react-query";
import {clearIdentityState} from "@/features/auth/clear-identity-state";
import {apiConfig} from "@/services/api/config";
import type { SettingKey } from "@/services/workspace/workspace.service";
import { useServiceAction, useServiceQuery } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { Button, LinkButton, PageHeading } from "@/components/ui/primitives";
import { confirmAction } from "@/components/ui/feedback";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { resetOrganizationDrafts } from "@/features/organization/draft-store";
import {AnalyticsPreference} from "./analytics-preference";

export function SettingsScreen() {
  const run = useServiceAction();
  const locked=useRef(false);
  const [pending,setPending]=useState(false);
  const router = useRouter();
  const cache=useQueryClient();
  const setUi = useUiStore((s) => s.setUi);
  const setOnboarding = useUiStore((s) => s.setOnboarding);
  const { data, isError, refetch } = useServiceQuery(["settings"], (s) => s.workspace.getSettings());
  const update = async (key: SettingKey, value: boolean) => {
    if(locked.current)return;locked.current=true;setPending(true);
    const ok = await run((s) => s.workspace.updateSetting(key, value));
    locked.current=false;setPending(false);
    if (ok !== undefined) toast(ok ? devCopy("Preference saved in this browser.", "Preference saved.") : "Saved for this page only. Browser storage is full or unavailable.");
  };
  const rows: [string, string, SettingKey, boolean][] = data
    ? [
        ["Profile visibility", "Show your profile in public profile views and talent discovery.", "profile-public", data.profilePublic],
        ["Portfolio visibility", devCopy("Allow portfolio preview through the shareable demo URL.", "Allow portfolio preview through your shareable URL."), "portfolio-public", data.portfolioPublic],
        ["Default work update visibility", "New updates start public. You can change each update individually.", "updates-public", data.updatesPublic],
        [devCopy("Demo notifications", "Notifications"), devCopy("Show illustrative activity notifications in your workspace.", "Show activity notifications in your workspace."), "notifications", data.notifications],
      ]
    : [];
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
    const ok=await run(async(s)=>{await s.workspace.signOut();return true;},{refresh:false});if(!ok)return;
    if(apiConfig.dataSource==="http"){clearIdentityState();cache.clear();router.push("/login");}else router.push("/");
    toast(devCopy("You’ve left the demo workspace. Local changes are kept.", "You’ve signed out."));
  };
  return (
    <>
      <PageHeading title="A little control goes a long way." subtitle={devCopy("Manage your account, visibility, and demo preferences.", "Manage your account, visibility, and preferences.")} />
      <section className="card form-card">
        <h2>Privacy & visibility</h2>
        <QueryFeedback data={data} error={isError} retry={refetch} layout="form" label="Loading privacy settings" />
        {data?.moderationHidden&&<p role="status">Your public profile is currently hidden by platform review. Your own visibility preferences are preserved.</p>}
        {rows.map(([title, description, key, value]) => (
          <div className="settings-row" key={key}>
            <div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
            <label className="switch">
              <input type="checkbox" checked={value} disabled={pending} aria-label={title} onChange={(e) => update(key, e.target.checked)} />
              <span />
            </label>
          </div>
        ))}
        <DevOnly>
          <div className="notice" style={{ marginTop: 22 }}>
            Visibility controls demonstrate product behavior in this browser. They are not server-enforced security. Demo messages, sample analytics, CV parsing, expiry dates, and OTP are simulations.
          </div>
        </DevOnly>
        <hr className="divider" />
        <h2>{devCopy("Demo account", "Account")}</h2>
        <div className="settings-row">
          <div>
            <h3>{data?.name}</h3>
            <p>{data?.email} · {devCopy("Professional demo account", "Professional account")}</p>
          </div>
          <LinkButton href="/app/profile" variant="sm" icon="edit">
            Edit profile
          </LinkButton>
        </div>
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
          <Button icon="logout" onClick={logout}>
            Log out
          </Button>
        </div>
      </section>
      {apiConfig.dataSource==="http"&&<AnalyticsPreference/>}
    </>
  );
}
