"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { OrgCheck, OrgField, OrgSelect } from "@/components/organization/controls";
import { QueryFeedback } from "@/components/ui/query-view";
import { ScreenError } from "@/components/ui/feedback";
import { Button } from "@/components/ui/primitives";
import { SettingsLinkCard } from "./settings-link-card";
import { apiConfig } from "@/services/api/config";
import { ApiError, errorMessage } from "@/services/api/client";
import { useServiceQuery, useServices } from "@/hooks/use-services";
import { validateOrganization, type FieldErrors } from "@/lib/domain/organization";
import { organizationSchema, verificationSchema } from "@/lib/validation/organization";
import { validationFields } from "@/lib/validation/profile";
import { devCopy } from "@/lib/env/app-env";
import { toast } from "@/stores/toast-store";
import { TEAM_WORKSPACE_ACCESS_ENABLED } from "@/lib/feature-flags";
import type { Organization } from "@/types/domain";

const CONTACT_KEYS = [
  "publicContactEmail",
  "publicPhone",
  "careersUrl",
  "profileVisibility",
  "showPublicContact",
  "showCareers",
  "acceptInquiries",
  "notifyApplications",
  "notifyTeam",
] as const;

type ContactKey = (typeof CONTACT_KEYS)[number];

function contactSlice(org: Organization) {
  return {
    publicContactEmail: org.publicContactEmail,
    publicPhone: org.publicPhone,
    careersUrl: org.careersUrl,
    profileVisibility: org.profileVisibility,
    showPublicContact: org.showPublicContact,
    showCareers: org.showCareers,
    acceptInquiries: org.acceptInquiries,
    notifyApplications: org.notifyApplications,
    notifyTeam: org.notifyTeam,
    socialLinks: { linkedin: org.socialLinks.linkedin, other: org.socialLinks.other },
  };
}

function applyContact(org: Organization, draft: ReturnType<typeof contactSlice>): Organization {
  return {
    ...org,
    ...draft,
    socialLinks: { ...org.socialLinks, linkedin: draft.socialLinks.linkedin, other: draft.socialLinks.other },
  };
}

/** Organization contact, visibility, and preference flags — edited in Settings. */
export function OrganizationContactSettings() {
  const services = useServices();
  const cache = useQueryClient();
  const query = useServiceQuery(["organization"], (s) => s.organization.getContext());
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [draft, setDraft] = useState<ReturnType<typeof contactSlice> | null>(null);
  const source = query.data?.workspace.organization;
  const canManage = query.data?.canManage ?? false;
  const verification = query.data?.workspace.verification;

  useEffect(() => {
    if (source) setDraft(contactSlice(source));
  }, [source]);

  const dirty = useMemo(() => {
    if (!source || !draft) return false;
    return JSON.stringify(contactSlice(source)) !== JSON.stringify(draft);
  }, [source, draft]);

  const setField = <K extends ContactKey>(key: K, value: Organization[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const save = async () => {
    if (!query.data || !draft || !source || !verification || locked.current || !dirty) return;
    if (!canManage) {
      toast("Only organization administrators can change these settings.", "error");
      return;
    }
    locked.current = true;
    setPending(true);
    try {
      const latest = await services.organization.getContext();
      if (!latest.canManage) {
        toast("Only organization administrators can change these settings.", "error");
        return;
      }
      const merged = applyContact(latest.workspace.organization, draft);
      const parsed = apiConfig.dataSource === "http" ? organizationSchema.safeParse(merged) : null;
      const proof = apiConfig.dataSource === "http" ? verificationSchema(false).safeParse(latest.workspace.verification) : null;
      const nextErrors = {
        ...validateOrganization(merged),
        ...(parsed && !parsed.success ? validationFields(parsed.error) : {}),
        ...(proof && !proof.success ? validationFields(proof.error) : {}),
      };
      const contactErrors = Object.fromEntries(
        Object.entries(nextErrors).filter(([key]) => key.startsWith("socialLinks") || CONTACT_KEYS.includes(key as ContactKey) || key === "applicationContact"),
      );
      // Surface contact-field issues here; other org-required fields still block save via full schema.
      if (Object.keys(nextErrors).length) {
        setErrors(Object.keys(contactErrors).length ? contactErrors : nextErrors);
        const first = Object.keys(contactErrors)[0] ?? Object.keys(nextErrors)[0];
        requestAnimationFrame(() => document.querySelector<HTMLElement>(`[name="${first}"], [id="org-${first.replaceAll(".", "-")}"]`)?.focus());
        if (!Object.keys(contactErrors).length) {
          toast("Fix required organization profile fields in the company editor before saving contact settings.", "error");
        }
        return;
      }
      setErrors({});
      await services.organization.saveOrganization(merged, latest.workspace.verification);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["organization"] }),
        cache.invalidateQueries({ queryKey: ["shell", "recruiter"] }),
        cache.invalidateQueries({ queryKey: ["company"] }),
      ]);
      setDraft(contactSlice(merged));
      toast(devCopy("Organization preferences saved in this browser.", "Organization preferences saved."));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast("Your organization changed. Reload this page before continuing.", "error");
        await query.refetch();
      } else {
        toast(errorMessage(error), "error");
      }
    } finally {
      locked.current = false;
      setPending(false);
    }
  };

  return (
    <>
      <section className="card form-card">
        <h2>Organization</h2>
        <p>Public contact details, organization visibility, and communication preferences.</p>
        {query.isError && !query.data ? (
          <ScreenError compact error={query.error} title="Organization settings couldn’t load" description="Your saved preferences haven’t changed. Please try again." onRetry={() => void query.refetch()} />
        ) : (
          <QueryFeedback data={query.data} error={query.isError} cause={query.error} retry={query.refetch} layout="form" label="Loading organization settings" />
        )}
        {draft && source ? (
          <>
            {!canManage ? <p role="status">Only organization administrators can change contact and visibility settings.</p> : null}
            <fieldset className="settings-org-fieldset" disabled={!canManage || pending}>
              <div className="org-form-grid settings-org-grid">
                <OrgField label="Public contact email" name="publicContactEmail" type="email" maxLength={150} value={draft.publicContactEmail} error={errors.publicContactEmail} onValue={(value) => setField("publicContactEmail", value)} />
                <OrgField label="Public phone" name="publicPhone" type="tel" maxLength={25} value={draft.publicPhone} error={errors.publicPhone} onValue={(value) => setField("publicPhone", value)} />
              <OrgField
                label="Public LinkedIn URL"
                name="socialLinks.linkedin"
                type="url"
                maxLength={250}
                value={draft.socialLinks.linkedin}
                error={errors["socialLinks.linkedin"]}
                onValue={(value) => {
                  setDraft((prev) => (prev ? { ...prev, socialLinks: { ...prev.socialLinks, linkedin: value } } : prev));
                  setErrors((prev) => {
                    if (!prev["socialLinks.linkedin"]) return prev;
                    const next = { ...prev };
                    delete next["socialLinks.linkedin"];
                    return next;
                  });
                }}
              />
              <OrgField
                label="Other public social URL"
                name="socialLinks.other"
                type="url"
                maxLength={250}
                value={draft.socialLinks.other}
                error={errors["socialLinks.other"]}
                onValue={(value) => {
                  setDraft((prev) => (prev ? { ...prev, socialLinks: { ...prev.socialLinks, other: value } } : prev));
                  setErrors((prev) => {
                    if (!prev["socialLinks.other"]) return prev;
                    const next = { ...prev };
                    delete next["socialLinks.other"];
                    return next;
                  });
                }}
              />
                <OrgField label="Careers page URL" name="careersUrl" type="url" maxLength={250} value={draft.careersUrl} error={errors.careersUrl} onValue={(value) => setField("careersUrl", value)} />
                <OrgSelect label="Organization profile visibility" name="profileVisibility" value={draft.profileVisibility} options={["Public", "Hidden"]} error={errors.profileVisibility} onValue={(value) => setField("profileVisibility", value as Organization["profileVisibility"])} />
              </div>
              <div className="org-setting-group">
                <h3>Public profile controls</h3>
                <OrgCheck label="Show public contact information" checked={draft.showPublicContact} onChange={(value) => setField("showPublicContact", value)} />
                <OrgCheck label="Show careers page link" checked={draft.showCareers} onChange={(value) => setField("showCareers", value)} />
              </div>
              <div className="org-setting-group">
                <h3>Private communication preferences</h3>
                <OrgCheck label="Open to candidate inquiries" checked={draft.acceptInquiries} onChange={(value) => setField("acceptInquiries", value)} hint={devCopy("A prototype preference; it does not send or block real messages.", undefined)} />
                <OrgCheck label="New application notifications" checked={draft.notifyApplications} onChange={(value) => setField("notifyApplications", value)} />
                <OrgCheck label="Team and invitation updates" checked={draft.notifyTeam} onChange={(value) => setField("notifyTeam", value)} />
              </div>
            </fieldset>
            <div className="form-actions">
              <Button variant="primary" icon="check" loading={pending} disabled={!canManage || !dirty || pending} onClick={() => void save()}>
                Save changes
              </Button>
            </div>
          </>
        ) : null}
      </section>
      {TEAM_WORKSPACE_ACCESS_ENABLED && apiConfig.dataSource === "http" ? (
        <section className="card form-card">
          <SettingsLinkCard href="/recruiter/access" icon="users" title="Team and workspace access" description="Manage who can administer this organization." />
        </section>
      ) : null}
    </>
  );
}
