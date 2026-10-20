import { create } from "zustand";
import { produce, type Draft } from "immer";
import type { Organization, RecruiterMember, Verification } from "@/types/domain";
import type { FieldErrors } from "@/lib/domain/organization";

export interface OrganizationDraft {
  organization: Organization;
  verification: Verification;
}

interface DraftState {
  /** Unsaved organization edits; shared by the editor and its preview page. */
  organization: OrganizationDraft | null;
  /** Unsaved recruiter identity edits, keyed by recruiter id. */
  recruiters: Record<string, RecruiterMember>;
  errors: FieldErrors;
  initOrganization: (saved: OrganizationDraft) => OrganizationDraft;
  updateOrganization: (recipe: (draft: Draft<OrganizationDraft>) => void) => void;
  discardOrganization: () => void;
  initRecruiter: (member: RecruiterMember) => RecruiterMember;
  updateRecruiter: (id: string, recipe: (draft: Draft<RecruiterMember>) => void) => void;
  discardRecruiter: (id: string) => void;
  setErrors: (errors: FieldErrors) => void;
}

export const useOrganizationDrafts = create<DraftState>((set, get) => ({
  organization: null,
  recruiters: {},
  errors: {},
  initOrganization: (saved) => {
    const existing = get().organization;
    if (existing) return existing;
    const draft = structuredClone(saved);
    set({ organization: draft });
    return draft;
  },
  updateOrganization: (recipe) => {
    const current = get().organization;
    if (current) set({ organization: produce(current, recipe) });
  },
  discardOrganization: () => set({ organization: null }),
  initRecruiter: (member) => {
    const existing = get().recruiters[member.id];
    if (existing) return existing;
    const draft = structuredClone(member);
    set({ recruiters: { ...get().recruiters, [member.id]: draft } });
    return draft;
  },
  updateRecruiter: (id, recipe) => {
    const current = get().recruiters[id];
    if (current) set({ recruiters: { ...get().recruiters, [id]: produce(current, recipe) } });
  },
  discardRecruiter: (id) => {
    const next = { ...get().recruiters };
    delete next[id];
    set({ recruiters: next });
  },
  setErrors: (errors) => set({ errors }),
}));

export const resetOrganizationDrafts = () => useOrganizationDrafts.setState({ organization: null, recruiters: {}, errors: {} });
