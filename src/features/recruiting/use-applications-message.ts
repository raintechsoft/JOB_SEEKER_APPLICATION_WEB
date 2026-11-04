"use client";

import { useAuthAction } from "@/features/auth/use-auth-action";
import { useServiceAction } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { useFloatingChatStore } from "@/stores/floating-chat-store";
import { useUiStore } from "@/stores/ui-store";
import type { Id } from "@/types/domain";

/** Opens (or focuses) a floating Applications chat widget — does not navigate to Messages. */
export function useApplicationsMessage() {
  const gate = useAuthAction();
  const run = useServiceAction();
  const setMessaging = useUiStore((s) => s.setMessaging);
  const openOrFocusChat = useFloatingChatStore((s) => s.openOrFocusChat);

  return async (
    candidateId: Id,
    person: { name: string; picture?: string; headline?: string },
  ) => {
    return gate.run(
      "message",
      async (context) => {
        if (context.role !== "recruiter") return;
        const conversationId = await run((s) => s.messaging.start(context.role, candidateId, { anyCompany: true }));
        if (!conversationId) return;
        setMessaging({ conversation: conversationId });
        openOrFocusChat({
          conversationId,
          candidateId,
          name: person.name,
          picture: person.picture,
          headline: person.headline,
        });
        modal.close();
      },
      { target: { kind: "person", id: candidateId } },
    );
  };
}
