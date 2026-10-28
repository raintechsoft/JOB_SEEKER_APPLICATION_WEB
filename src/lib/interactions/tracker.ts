import type { InteractionAction, InteractionKind } from "@/lib/validation/interactions";

/**
 * First-party watch history for recommendations. Components describe what was seen; the installed sink
 * (real API mode, signed in) batches and sends it. The default sink does nothing, so mock mode, server
 * rendering and signed-out pages never send anything. Likes, saves, follows and applications are recorded
 * by the server, so only passive events are reported here.
 */
export interface InteractionInput {
  action: InteractionAction;
  itemKind: InteractionKind;
  itemId: string;
  surface?: string;
  position?: number;
  dwellMs?: number;
  requestId?: string;
}

export interface InteractionSink {
  record(input: InteractionInput): void;
}

const noop: InteractionSink = { record() {} };
let sink = noop;
const collectors = new Set<() => void>();

export function setInteractionSink(next: InteractionSink | null) {
  sink = next ?? noop;
}

export function recordInteraction(input: InteractionInput) {
  try {
    sink.record(input);
  } catch {
    // Watch history must never break the product experience.
  }
}

/** Visible items register how to report time spent so far; called right before the page is left. */
export function registerDwellCollector(collect: () => void): () => void {
  collectors.add(collect);
  return () => collectors.delete(collect);
}

export function collectPendingDwell() {
  for (const collect of [...collectors]) {
    try {
      collect();
    } catch {
      // One faulty card cannot stop the others from reporting.
    }
  }
}
