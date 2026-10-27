export const journeyEnabled =
  process.env.NEXT_PUBLIC_CAREER_JOURNEY_ENABLED === "true";
export interface JourneyPhoto {
  id: string;
  url: string;
  alt: string;
  name: string;
  bytes: number;
}
export interface JourneyColleague {
  personId?: string;
  picture?: string;
  profileHref?: string;
  id: string;
  employmentId: string;
  name: string;
  role: string;
  profileSlug: string;
}
export interface CareerMemory {
  id: string;
  employmentId: string;
  title: string;
  story: string;
  date: string;
  type: "Moment" | "Milestone" | "Reflection";
  public: boolean;
  photos: JourneyPhoto[];
  colleagueIds?: string[];
}
export type MemoryInput = Omit<CareerMemory, "id">;
export interface JourneyChapter {
  id: string;
  company: string;
  title: string;
  start: string;
  end: string;
  current: boolean;
  public: boolean;
  years: number[];
  memoryCount?: number;
  colleagues?: JourneyColleague[];
}
export interface JourneyView {
  chapters: JourneyChapter[];
  profileVersion?: number;
  profilePublic?: boolean;
}
export interface MemoryPage {
  items: CareerMemory[];
  nextPage: number | null;
}
export interface MemoryFilters {
  employmentId?: string;
  year?: number;
  page?: number;
}
export interface JourneyStore {
  memories: CareerMemory[];
  colleagues: JourneyColleague[];
}
export interface JourneyService {
  following(
    employmentId: string,
  ): Promise<import("@/types/api").PersonSummary[]>;
  get(slug?: string): Promise<JourneyView>;
  memories(filters?: MemoryFilters, slug?: string): Promise<MemoryPage>;
  saveMemory(input: MemoryInput, version: number, id?: string): Promise<void>;
  deleteMemory(id: string, version: number): Promise<void>;
  saveColleague(
    input: { employmentId: string; personId: string; role: string },
    version: number,
    id?: string,
  ): Promise<void>;
  deleteColleague(id: string, version: number): Promise<void>;
  upload(file: File): Promise<JourneyPhoto>;
  discardPhoto(id: string): Promise<void>;
}
