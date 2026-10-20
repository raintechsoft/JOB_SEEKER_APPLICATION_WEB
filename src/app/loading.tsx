import { ScreenFallback } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <main id="main" className="container section">
      <ScreenFallback label="Loading…" />
    </main>
  );
}
