import { createStore } from "zustand/vanilla";
import { produce, type Draft } from "immer";
import type { DemoDatabase } from "@/types/domain";
import { createSeed } from "../seed";
import { normalizeDatabase } from "./normalize";

/**
 * MOCK BACKEND STORAGE.
 *
 * The prototype keeps its whole dataset in one `localStorage` entry. This module reproduces that
 * behaviour behind a tiny store so that mock services (`src/services/**`) can read and write it.
 * Nothing here is used once the real HTTP API is configured.
 */
export const DEMO_STORAGE_KEY = "skillora-demo-v1";

interface DemoDbState {
  db: DemoDatabase | null;
}

export const demoDbStore = createStore<DemoDbState>(() => ({ db: null }));

function writeStorage(db: DemoDatabase) {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(db));
    return true;
  } catch {
    return false;
  }
}

function readStorage(): DemoDatabase | null {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DemoDatabase>;
    if (parsed?.schema === 1 && parsed.professionals?.length === 12 && parsed.portfolios) return parsed as DemoDatabase;
  } catch {
    // Corrupt or inaccessible storage falls back to a fresh seed, as in the prototype.
  }
  return null;
}

/** Current database, loading it from browser storage on first access. Browser-only. */
export function getDb(): DemoDatabase {
  const current = demoDbStore.getState().db;
  if (current) return current;
  if (typeof window === "undefined") {
    throw new Error("The demo database is stored in the browser and is not available during server rendering.");
  }
  const db = produce(readStorage() ?? createSeed(), normalizeDatabase);
  writeStorage(db);
  demoDbStore.setState({ db });
  return db;
}

export interface CommitOptions {
  /** When storage is full, discard the change instead of keeping it for this page only. */
  rollbackOnFailure?: boolean;
}

/**
 * Applies a change and persists it. Returns whether the change was written to browser storage.
 * Without `rollbackOnFailure`, a failed write still keeps the change in memory for this session
 * (the prototype's "Saved for this page only" behaviour).
 */
export function commit(recipe: (draft: Draft<DemoDatabase>) => void, options: CommitOptions = {}): boolean {
  const next = produce(getDb(), (draft) => {
    recipe(draft);
  });
  const persisted = writeStorage(next);
  if (!persisted && options.rollbackOnFailure) return false;
  demoDbStore.setState({ db: next });
  return persisted;
}

/** Restores all sample content. */
export function resetDb() {
  const db = produce(createSeed(), normalizeDatabase);
  writeStorage(db);
  demoDbStore.setState({ db });
}

/** Re-reads the persisted copy (used by the jobs manager "Refresh" action). */
export function reloadDb() {
  const stored = readStorage();
  if (stored) demoDbStore.setState({ db: produce(stored, normalizeDatabase) });
}
