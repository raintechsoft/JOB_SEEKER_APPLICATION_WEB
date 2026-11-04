"use client";

import { useEffect } from "react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { useObservedSession } from "@/features/auth/use-observed-session";
import { useFloatingChatStore } from "@/stores/floating-chat-store";
import { FloatingChatWidget } from "./floating-chat-widget";

type Props = {
  /** Applications job id from `/recruiter/applications?job=` (or table equivalent). */
  jobId: string;
};

/** LinkedIn-style multi-chat dock for a single Applications job route. */
export function FloatingChatDock({ jobId }: Props) {
  const session = useObservedSession();
  const userId = session?.user.id;
  const identityId = session?.selected_identity_id ?? undefined;
  const widgets = useFloatingChatStore((s) => s.widgets);
  const reorderWidgets = useFloatingChatStore((s) => s.reorderWidgets);
  const hydrateFromStorage = useFloatingChatStore((s) => s.hydrateFromStorage);
  const parkSession = useFloatingChatStore((s) => s.parkSession);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    hydrateFromStorage(userId, identityId, jobId);
    return () => {
      parkSession();
    };
  }, [hydrateFromStorage, parkSession, userId, identityId, jobId]);

  if (!widgets.length) return null;

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorderWidgets(String(active.id), String(over.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={widgets.map((w) => w.conversationId)} strategy={horizontalListSortingStrategy}>
        <div className="floating-chat-dock" aria-label="Application chats">
          {widgets.map((chat) => (
            <FloatingChatWidget key={chat.conversationId} chat={chat} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
