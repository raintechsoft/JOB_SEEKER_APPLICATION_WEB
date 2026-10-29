import type { AuthSession } from "../auth/auth.service";
import { ApiError, type HttpClient } from "../api/client";
import { collectPendingDwell, setInteractionSink, type InteractionInput } from "@/lib/interactions/tracker";
import { INTERACTION_RULES, interactionEventSchema, type InteractionEvent } from "@/lib/validation/interactions";

const QUEUE_MAX = 100;
const VIEW_REPEAT_MS = 30 * 60_000;

/** Batches watch history for the selected workspace. Nothing is kept across sign-out or a workspace switch. */
export function createHttpInteractionsService(http: HttpClient, options: { flushMs?: number } = {}) {
  const flushMs = options.flushMs ?? 10_000;
  let identity: string | null = null, epoch = 0, sending = false, retryAt = 0;
  let queue: InteractionEvent[] = [];
  let viewed = new Map<string, number>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = (delay = flushMs) => { if (!timer) timer = setTimeout(() => { timer = undefined; void flush(); }, delay); };

  function record(input: InteractionInput) {
    if (!identity) return;
    if (input.action === "view") {
      // Scrolling back and forth over the same card is one view.
      const key = `${input.itemKind}:${input.itemId}:${input.surface ?? ""}`, last = viewed.get(key);
      if (last !== undefined && Date.now() - last < VIEW_REPEAT_MS) return;
      viewed.set(key, Date.now());
    }
    const event = interactionEventSchema.safeParse({ id: crypto.randomUUID(), occurredAt: new Date().toISOString(), ...input });
    if (!event.success) return;
    queue.push(event.data);
    if (queue.length > QUEUE_MAX) queue.splice(0, queue.length - QUEUE_MAX);
    if (queue.length >= INTERACTION_RULES.batchMax) void flush(); else schedule();
  }

  async function flush() {
    if (sending || !identity || !queue.length) return;
    if (Date.now() < retryAt) return schedule(retryAt - Date.now());
    const generation = epoch, batch = queue.splice(0, INTERACTION_RULES.batchMax);
    sending = true;
    try {
      await http.post("me/interactions", { identityId: identity, events: batch });
    } catch (error) {
      // A rejected batch (4xx) would fail again; network errors, 429 and 5xx keep it for the next attempt.
      const status = error instanceof ApiError ? error.status : 0;
      if (generation === epoch && (status === 0 || status === 429 || status >= 500)) {
        if (status === 429) retryAt = Date.now() + (error instanceof ApiError && error.retryAfterSeconds ? error.retryAfterSeconds : 60) * 1000;
        queue = [...batch, ...queue].slice(-QUEUE_MAX);
      }
    } finally {
      sending = false;
      if (generation === epoch && queue.length) schedule();
    }
  }

  function leave() {
    if (!identity) return;
    collectPendingDwell();
    while (queue.length) {
      if (!http.beacon("me/interactions", { identityId: identity, events: queue.slice(0, INTERACTION_RULES.batchMax) })) return;
      queue.splice(0, INTERACTION_RULES.batchMax);
    }
  }
  const onVisibility = () => { if (document.visibilityState === "hidden") leave(); };
  let listening = false;

  function reset() {
    epoch++;
    identity = null;
    queue = [];
    viewed = new Map();
    retryAt = 0;
    if (timer) clearTimeout(timer);
    timer = undefined;
    setInteractionSink(null);
    if (listening) {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", leave);
      listening = false;
    }
  }

  return {
    reset,
    flush,
    attach(session: AuthSession) {
      reset();
      if (!session.selected_identity_id || typeof window === "undefined") return;
      identity = session.selected_identity_id;
      setInteractionSink({ record });
      if (!listening) {
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("pagehide", leave);
        listening = true;
      }
      // Personalisation off (F12): stop before anything is sent (batches leave only after flushMs).
      const attached = epoch;
      void http.get<{ data: { personalize: boolean } }>("me/personalization").then((r) => { if (attached === epoch && !r.data.personalize) reset(); }, () => undefined);
    },
    /** Called when the person switches personalisation; off removes the sink and drops what is queued. */
    setEnabled(enabled: boolean, session: AuthSession | null) {
      if (!enabled) reset();
      else if (session && !identity) this.attach(session);
    },
  };
}
