import type { HttpClient } from "../api/client";
import { validateMedia, type MediaPurpose } from "@/lib/validation/profile";

import type { components } from "@/types/generated/api";
export type UploadedAsset = components["schemas"]["ManagedAsset"];
export interface MediaService {
  upload(file: File, purpose: MediaPurpose, organization?: string): Promise<UploadedAsset>;
  remove(id: string): Promise<void>;
}
export function createMediaService(http: HttpClient): MediaService {
  return {
    async upload(file, purpose, organization) {
      const error = validateMedia(file, purpose);
      if (error) throw new Error(error);
      const { data: intent } = await http.post<{ data: { id: string } }>("media", { name: file.name, mime: file.type, bytes: file.size, purpose, ...(organization ? { organization_id: organization } : {}) });
      try {
        await http.upload(`media/${intent.id}/content`, file);
        return (await http.post<{ data: UploadedAsset }>(`media/${intent.id}/complete`)).data;
      } catch (error) {
        await http.delete(`media/${intent.id}`).catch(() => undefined);
        throw error;
      }
    },
    remove: (id) => http.delete(`media/${encodeURIComponent(id)}`),
  };
}
