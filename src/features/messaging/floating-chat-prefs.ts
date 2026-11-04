import { z } from "zod";
import type { Id } from "@/types/domain";

const PREFIX = "floating-chats:v1:";

export type FloatingChat = {
  conversationId: Id;
  candidateId: Id;
  name: string;
  picture?: string;
  headline?: string;
  minimized: boolean;
  maximized: boolean;
  /** Monotonic open time; when over the open-panel cap, oldest open chats minimize first. */
  openedAt: number;
};

export function floatingChatPrefsKey(
  userId: string | undefined,
  identityId: string | undefined,
  jobId: string | undefined,
) {
  return PREFIX + (userId || "guest") + ":" + (identityId || "guest") + ":" + (jobId || "none");
}

const floatingChatSchema = z.object({
  conversationId: z.string().min(1),
  candidateId: z.string().min(1),
  name: z.string().min(1),
  picture: z.string().optional(),
  headline: z.string().optional(),
  minimized: z.boolean(),
  maximized: z.boolean(),
  openedAt: z.number().finite(),
});

/** Drop invalid entries and ensure at most one maximized widget. */
export function normalizeFloatingChats(raw: unknown): FloatingChat[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const widgets: FloatingChat[] = [];
  for (const entry of raw) {
    const parsed = floatingChatSchema.safeParse(entry);
    if (!parsed.success) continue;
    const row = parsed.data;
    if (seen.has(row.conversationId)) continue;
    seen.add(row.conversationId);
    widgets.push({
      conversationId: row.conversationId,
      candidateId: row.candidateId,
      name: row.name,
      ...(row.picture ? { picture: row.picture } : {}),
      ...(row.headline ? { headline: row.headline } : {}),
      minimized: row.minimized,
      maximized: row.maximized,
      openedAt: row.openedAt,
    });
  }
  let foundMax = false;
  return widgets.map((w) => {
    if (!w.maximized) return w;
    if (foundMax) return { ...w, maximized: false };
    foundMax = true;
    return w;
  });
}

export function loadFloatingChats(
  userId?: string,
  identityId?: string,
  jobId?: string,
): FloatingChat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(floatingChatPrefsKey(userId, identityId, jobId));
    if (!raw) return [];
    return normalizeFloatingChats(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveFloatingChats(
  widgets: FloatingChat[],
  userId?: string,
  identityId?: string,
  jobId?: string,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      floatingChatPrefsKey(userId, identityId, jobId),
      JSON.stringify(normalizeFloatingChats(widgets)),
    );
  } catch {
    /* ignore quota */
  }
}

export function clearFloatingChats(userId?: string, identityId?: string, jobId?: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(floatingChatPrefsKey(userId, identityId, jobId));
  } catch {
    /* ignore */
  }
}
