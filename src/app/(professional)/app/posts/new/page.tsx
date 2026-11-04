import type { Metadata } from "next";
import { Suspense } from "react";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { PostEditorScreen } from "@/features/posts/post-editor-screen";

export const metadata: Metadata = { title: "new" };

export default function Page() {
  return (
    <Suspense fallback={<ContentSkeleton layout="form" label="Loading post editor" />}>
      <PostEditorScreen role="professional" />
    </Suspense>
  );
}
