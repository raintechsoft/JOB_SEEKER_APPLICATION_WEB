"use client";

import { useEffect, useMemo, useState } from "react";
import type { Draft } from "immer";
import type { Organization, RecruiterMember, WorkplaceImage } from "@/types/domain";
import { useServiceQuery, useServices } from "@/hooks/use-services";
import { apiConfig } from "@/services/api/config";
import type { MediaPurpose } from "@/lib/validation/profile";
import { validateMedia } from "@/lib/validation/profile";
import { IMAGE_TYPES, KB, MB, readImage } from "@/lib/utils/files";
import { splitList } from "@/lib/utils/text";
import { uid } from "@/lib/utils/id";
import { toast } from "@/stores/toast-store";
import { useOrganizationDrafts, type OrganizationDraft } from "./draft-store";

export const ADMIN_ONLY = "An organization admin manages this action.";

/** Adds comma/newline separated chip values (unique, case-insensitive, max 20). */
export function addChips(list: string[], raw: string) {
  const next = [...list];
  for (const value of splitList(raw).filter((v) => v.length <= 100)) if (next.length < 20 && !next.some((v) => v.toLowerCase() === value.toLowerCase())) next.push(value);
  return next;
}

/** Shared state for the organization editor and its preview (prototype `organizationDraft`). */
export function useOrganizationEditor() {
  const query = useServiceQuery(["organization"], (s) => s.organization.getContext());
  const ctx = query.data;
  const { organization: draft, errors, initOrganization, updateOrganization, discardOrganization, setErrors } = useOrganizationDrafts();
  useEffect(() => {
    if (ctx && (!draft || draft.organization.id !== ctx.workspace.organization.id)) {
      if (draft) discardOrganization();
      initOrganization({ organization: ctx.workspace.organization, verification: ctx.workspace.verification });
    }
  }, [ctx, draft, initOrganization, discardOrganization]);
  const saved = useMemo<OrganizationDraft | null>(() => (ctx ? { organization: ctx.workspace.organization, verification: ctx.workspace.verification } : null), [ctx]);
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);
  const canManage = !!ctx?.canManage;
  const guard = () => {
    if (!canManage) toast(ADMIN_ONLY);
    return canManage;
  };
  const setOrg = (recipe: (o: Draft<Organization>) => void) => updateOrganization((d) => recipe(d.organization));
  return { query, ctx, draft: ctx && draft?.organization.id !== ctx.workspace.organization.id ? null : draft, saved, dirty, errors, setErrors, canManage, guard, setOrg, updateOrganization, discardOrganization };
}

const UPLOAD_ERROR = (max: number) => "Use PNG, JPEG or WebP images up to " + (max === MB ? "1 MB" : "500 KB") + ".";

/** Validates and decodes uploaded images (logo, cover, gallery, recruiter photo). */
export function useImageUploads() {
  const services = useServices();
  const [busy, setBusy] = useState(false);
  const load = async (files: File[], max: number, purpose: MediaPurpose = "gallery"): Promise<WorkplaceImage[] | null> => {
    if (busy) {
      toast("Wait for the current image to finish loading.");
      return null;
    }
    if (apiConfig.dataSource !== "http" && files.some((f) => f.size > max || !IMAGE_TYPES.includes(f.type))) {
      toast(UPLOAD_ERROR(max));
      return null;
    }
    setBusy(true);
    try {
      if (apiConfig.dataSource === "http") {
        for (const file of files) { const error = validateMedia(file, purpose); if (error) throw new Error(error); }
        const context = await services.organization.getContext();
        const images: WorkplaceImage[] = await Promise.all(files.map(async file => {
          const asset = await services.media.upload(file, purpose, context.workspace.organization.id, {manual:purpose==="gallery"});
          return { id: asset.id, url: asset.url, alt: file.name.replace(/\.[^.]+$/, ""), bytes: asset.bytes };
        }));
        if (purpose !== "recruiter_photo" && useOrganizationDrafts.getState().organization?.organization.id !== context.workspace.organization.id) throw new Error("Your workspace changed. Reopen the original organization to continue editing.");
        toast("Image uploaded. Save your changes to attach it.");
        return images;
      }
      const images = await Promise.all(files.map(async (file) => ({ id: uid(), url: await readImage(file), alt: file.name.replace(/\.[^.]+$/, ""), bytes: file.size })));
      toast("Image added to your unsaved changes.");
      return images;
    } catch (e) {
      toast(e instanceof Error ? e.message : "The image could not be read.");
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { busy, load, limits: { logo: 500 * KB, cover: MB, gallery: 500 * KB, photo: 500 * KB } };
}

export function useRecruiterDraft(member: RecruiterMember | undefined) {
  const { recruiters, initRecruiter, updateRecruiter, discardRecruiter } = useOrganizationDrafts();
  useEffect(() => {
    if (member && !recruiters[member.id]) initRecruiter(member);
  }, [member, recruiters, initRecruiter]);
  return { draft: member ? recruiters[member.id] : undefined, update: (recipe: (r: Draft<RecruiterMember>) => void) => member && updateRecruiter(member.id, recipe), discard: () => member && discardRecruiter(member.id) };
}
