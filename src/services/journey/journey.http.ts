import type { HttpClient } from "../api/client";
import type { MediaService } from "../media/media.http";
import type {
  JourneyService,
  JourneyView,
  MemoryPage,
} from "./journey.service";
import { colleagueSchema } from "@/lib/validation/journey";

export function createHttpJourneyService(
  http: HttpClient,
  media: MediaService,
): JourneyService {
  const root = (slug?: string) =>
    slug
      ? `professionals/${encodeURIComponent(slug)}/journey`
      : "me/profile/journey";
  return {
    async following(employmentId) {
      return (
        await http.get<{ data: import("@/types/api").PersonSummary[] }>(
          `${root()}/colleagues/candidates?${new URLSearchParams({ employmentId })}`,
        )
      ).data;
    },
    async get(slug) {
      return (await http.get<{ data: JourneyView }>(root(slug))).data;
    },
    async memories(filters = {}, slug) {
      const query = new URLSearchParams();
      for (const [key, v] of Object.entries(filters))
        if (v !== undefined) query.set(key, String(v));
      return (
        await http.get<{ data: MemoryPage }>(`${root(slug)}/memories?${query}`)
      ).data;
    },
    async saveMemory(input, version, id) {
      const body = {
        ...input,
        photos: input.photos.map((p) => ({ id: p.id, alt: p.alt })),
        profile_version: version,
      };
      if (id) await http.patch(`${root()}/memories/${id}`, body);
      else await http.post(`${root()}/memories`, body);
    },
    async deleteMemory(id, version) {
      await http.post(`${root()}/memories/${id}/delete`, {
        profile_version: version,
      });
    },
    async saveColleague(input, version, id) {
      const body = {
        ...colleagueSchema.parse(input),
        profile_version: version,
      };
      if (id) await http.patch(`${root()}/colleagues/${id}`, body);
      else await http.post(`${root()}/colleagues`, body);
    },
    async deleteColleague(id, version) {
      await http.post(`${root()}/colleagues/${id}/delete`, {
        profile_version: version,
      });
    },
    async upload(file) {
      const asset = await media.upload(file, "career_memory");
      return { ...asset, alt: "" };
    },
    discardPhoto: (id) => media.remove(id),
  };
}
