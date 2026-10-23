import type { Metadata } from "next";
import { Suspense } from "react";
import { PostEditorScreen } from "@/features/posts/post-editor-screen";

export const metadata: Metadata = { title: "new" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PostEditorScreen role="professional" />
    </Suspense>
  );
}
