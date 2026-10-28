import { create } from "zustand";
import {apiConfig} from "@/services/api/config";
import type { Id } from "@/types/domain";
import type { FeedFilter, FeedSort } from "@/services/feed/feed.service";
import type { MessageFilter } from "@/services/messaging/messaging.service";
import { EMPTY_TALENT_FILTERS, type TalentFilters } from "@/services/talent/talent.service";
import type { SearchScope, SearchOptions } from "@/lib/search/scopes";

/**
 * Session-scoped interface state shared between components.
 *
 * The prototype kept these as module-level objects, so they survive navigation within a visit
 * (for example the feed filter, the compared candidates or the selected conversation). Nothing
 * here is persisted; durable data lives behind the service layer.
 */
interface UiState {
  feed: { filter: FeedFilter; sort: FeedSort; query: string; searchScope: SearchScope; searchOptions: SearchOptions; visible: number; openComments: Id[]; expanded: Id[]; editingComment: Id | null };
  jobsPanel: { view: "all" | "alerts"; mobileOpen: boolean };
  messaging: { query: string; filter: MessageFilter; mobileChat: boolean; conversation: Id | null };
  talent: TalentFilters;
  shortlistTab: Id | null;
  compared: Id[];
  previewMobile: boolean;
  pulseRange: 91 | 365;
  onboarding: { role: "professional" | "recruiter"; step: number; cvName: string; cvParsed: boolean };
  responses: { selection: Id[]; showFilters: boolean };
  jobsManager: { selected: Id[]; mobileFilters: boolean };
  teamFilter: { q: string; role: string; status: string };
  authRole: "professional" | "recruiter";
  setFeed: (patch: Partial<UiState["feed"]>) => void;
  toggleFeedList: (key: "openComments" | "expanded", id: Id) => void;
  setJobsPanel: (patch: Partial<UiState["jobsPanel"]>) => void;
  setMessaging: (patch: Partial<UiState["messaging"]>) => void;
  setTalent: (patch: Partial<TalentFilters>) => void;
  setUi: (patch: Partial<Pick<UiState, "shortlistTab" | "compared" | "previewMobile" | "pulseRange" | "authRole">>) => void;
  setOnboarding: (patch: Partial<UiState["onboarding"]>) => void;
  setResponses: (patch: Partial<UiState["responses"]>) => void;
  setJobsManager: (patch: Partial<UiState["jobsManager"]>) => void;
  setTeamFilter: (patch: Partial<UiState["teamFilter"]>) => void;
}

export const useUiStore = create<UiState>((set) => ({
  feed: { filter: "all", sort: "recent", query: "", searchScope: "all", searchOptions: {}, visible: 12, openComments: [], expanded: [], editingComment: null },
  jobsPanel: { view: "all", mobileOpen: false },
  messaging: { query: "", filter: "all", mobileChat: false, conversation: apiConfig.dataSource==="http"?null:"conv0" },
  talent: EMPTY_TALENT_FILTERS,
  shortlistTab: "s0",
  compared: ["p0", "p3"],
  previewMobile: false,
  pulseRange: 91,
  onboarding: { role: "professional", step: 0, cvName: "", cvParsed: false },
  responses: { selection: [], showFilters: false },
  jobsManager: { selected: [], mobileFilters: false },
  teamFilter: { q: "", role: "", status: "" },
  authRole: "professional",
  setFeed: (patch) => set((s) => ({ feed: { ...s.feed, ...patch } })),
  toggleFeedList: (key, id) => set((s) => ({ feed: { ...s.feed, [key]: s.feed[key].includes(id) ? s.feed[key].filter((v) => v !== id) : [...s.feed[key], id] } })),
  setJobsPanel: (patch) => set((s) => ({ jobsPanel: { ...s.jobsPanel, ...patch } })),
  setMessaging: (patch) => set((s) => ({ messaging: { ...s.messaging, ...patch } })),
  setTalent: (patch) => set((s) => ({ talent: { ...s.talent, ...patch } })),
  setUi: (patch) => set(patch),
  setOnboarding: (patch) => set((s) => ({ onboarding: { ...s.onboarding, ...patch } })),
  setResponses: (patch) => set((s) => ({ responses: { ...s.responses, ...patch } })),
  setJobsManager: (patch) => set((s) => ({ jobsManager: { ...s.jobsManager, ...patch } })),
  setTeamFilter: (patch) => set((s) => ({ teamFilter: { ...s.teamFilter, ...patch } })),
}));
