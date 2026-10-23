import type { Discipline, Id, IsoDate, Project, Visibility, WorkUpdate } from "@/types/domain";

export interface PulseCell {
  date: IsoDate;
  count: number;
}

export interface Pulse {
  cells: PulseCell[];
  months: string[];
  totalDays: number;
  /** Updates inside the requested range. */
  updateCount: number;
  activeDays: number;
  projectCount: number;
  /** Days ago (0–21) with at least one update, for the compact mini pulse. */
  recentDays: number[];
}

export interface ProjectQuery {
  ownerId: Id;
  category?: Discipline | "";
  visibility?: Visibility | "";
  q?: string;
}

export type ProjectInput = Omit<Project, "id" | "owner" | "art" | "cover"> & { id?: Id; coverFile?: File | null };

export type UpdateInput = Omit<WorkUpdate, "id" | "owner"> & { id?: Id };

export interface WorkService {
  featuredProjects?():Promise<Project[]>;
  listProjects(query: ProjectQuery): Promise<Project[]>;
  getProject(id: Id): Promise<Project | null>;
  /** Projects by id, in the order given (missing ids are skipped). */
  getProjects(ids: Id[]): Promise<Project[]>;
  /** Returns an error message when the input is rejected. */
  saveProject(input: ProjectInput): Promise<{ ok: true; persisted: boolean } | { ok: false; error: string }>;
  deleteProject(id: Id): Promise<void>;
  setProjectFeatured(id: Id, featured: boolean): Promise<void>;
  listUpdates(ownerId: Id, options?: { publicOnly?: boolean; date?: IsoDate; limit?: number }): Promise<WorkUpdate[]>;
  getUpdate(id: Id): Promise<WorkUpdate | null>;
  saveUpdate(input: UpdateInput): Promise<boolean>;
  deleteUpdate(id: Id): Promise<void>;
  getPulse(ownerId: Id, days: number): Promise<Pulse>;
}
