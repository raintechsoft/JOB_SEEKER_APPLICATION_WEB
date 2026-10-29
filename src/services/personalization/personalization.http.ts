import { z } from "zod";
import type { HttpClient } from "../api/client";
import type { PersonalizationService, PersonalizationSettings } from "./personalization.service";

const settingsSchema = z.object({ personalize: z.boolean(), searchHistory: z.boolean() }).strict();

/** `onChange` lets the interactions tracker stop (or resume) the moment personalisation is switched. */
export function createHttpPersonalizationService(http: HttpClient, onChange: (settings: PersonalizationSettings) => void): PersonalizationService {
  return {
    async get() {
      return settingsSchema.parse((await http.get<{ data: unknown }>("me/personalization")).data);
    },
    async set(key, value) {
      const settings = settingsSchema.parse((await http.patch<{ data: unknown }>("me/personalization", { key: z.enum(["personalize", "searchHistory"]).parse(key), value: z.boolean().parse(value) })).data);
      onChange(settings);
      return settings;
    },
    async clearHistory() {
      await http.delete("me/personalization/history");
    },
    async exportData() {
      return (await http.get<{ data: unknown }>("me/personalization/export")).data;
    },
  };
}
