/** Account-wide personalisation choices (F12), both roles. */
export interface PersonalizationSettings {
  /** Use my activity (views, reading, saves, likes, searches) to personalise. Off: nothing is recorded. */
  personalize: boolean;
  /** Keep my recent searches. */
  searchHistory: boolean;
}

export interface PersonalizationService {
  get(): Promise<PersonalizationSettings>;
  set(key: keyof PersonalizationSettings, value: boolean): Promise<PersonalizationSettings>;
  /** Deletes watch history, served lists and search history; "Not interested" choices are kept. */
  clearHistory(): Promise<void>;
  /** Everything kept for recommendations and what is inferred from it, as a JSON document (F10). */
  exportData(): Promise<unknown>;
}
