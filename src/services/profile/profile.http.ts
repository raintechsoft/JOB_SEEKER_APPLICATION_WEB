import type { HttpClient } from "../api/client";
import type { ProfileService, ProfileView } from "./profile.service";
import type { MediaService } from "../media/media.http";
import { profileRecordSchema, profileSectionSchema, validateMedia } from "@/lib/validation/profile";
import { z } from "zod";

export function createHttpProfileService(http: HttpClient, media: MediaService, moveProject?: (id: string, offset: -1 | 1) => Promise<void>): ProfileService & { reset(): void } {
  let version: number | null = null;
  let current: ProfileView | null = null;
  const getProfile = async () => {
    const { data } = await http.get<{ data: ProfileView & { version: number } }>("me/profile");
    version = data.version; current = data;
    return data;
  };
  const mutate = async (path: string, body: object, patch = false, expected?: number) => {
    if (version === null) await getProfile();
    const { data } = await (patch ? http.patch : http.post)<{ data: { version: number } }>(path, { ...body, profile_version: expected ?? version });
    version = data.version;
  };
  return {
    reset() { version = null; current = null; },
    getProfile,
    async saveSection(section, input, revision) {
      const values = profileSectionSchema(section).parse(input);
      await mutate(`me/profile/sections/${section}`, values, true, revision);
      return { ok: true };
    },
    async saveRecord(collection, input, revision) {
      const values = profileRecordSchema(collection).parse(input);
      if (input.projects) z.array(z.uuid()).max(50).refine((ids) => new Set(ids).size === ids.length).parse(input.projects);
      if (input.project) z.uuid().parse(input.project);
      await mutate(`me/profile/records/${collection}`, values, false, revision);
      return { ok: true };
    },
    deleteRecord: (collection, id, revision, confirmJourneyDelete = false) => mutate(`me/profile/records/${collection}/${encodeURIComponent(id)}/delete`, {confirm_journey_delete:confirmJourneyDelete}, false, revision),
    moveRecord: (collection, id, offset, revision) => collection === "projects" && moveProject ? moveProject(id, offset) : mutate(`me/profile/records/${collection}/${encodeURIComponent(id)}/move`, { offset }, false, revision),
    toggleFeaturedSkill: (id, revision) => mutate(`me/profile/records/skills/${encodeURIComponent(id)}/feature`, {}, false, revision),
    async setPhoto(file, revision) {
      const error = validateMedia(file, "portrait"); if (error) return { ok: false, error };
      const asset = await media.upload(file, "portrait");
      await mutate("me/profile/assets/portrait", { asset_id: asset.id }, false, revision);
      return { ok: true };
    },
    useDefaultPhoto: (revision) => mutate("me/profile/assets/portrait", { asset_id: null }, false, revision),
    async uploadResume(file, revision) {
      const error = validateMedia(file, "resume"); if (error) return { ok: false, error };
      const asset = await media.upload(file, "resume");
      await mutate("me/profile/assets/resume", { asset_id: asset.id }, false, revision);
      return { ok: true };
    },
    async downloadResume() {
      const profile = current ?? await getProfile();
      const resume = profile.details.resume;
      return resume ? { name: resume.name, blob: await http.blob(`media/${resume.id}/download`) } : null;
    },
    async removeResume(revision) {
      const old = (current ?? await getProfile()).details.resume;
      await mutate("me/profile/assets/resume", { asset_id: null }, false, revision);
      if (old) await media.remove(old.id);
      return { ok: true };
    },
  };
}
