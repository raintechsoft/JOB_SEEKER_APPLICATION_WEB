import { LinkButton } from "@/components/ui/primitives";
import { StatePanel } from "@/components/ui/state-panel";

export default function NotFound() {
  return (
    <main id="main" className="container section state-page">
      <StatePanel
        icon="compass"
        title="Page not found"
        description="The link may be broken, or the page may have been moved or removed."
        actions={<>
          <LinkButton href="/" variant="primary" icon="home">Back to Skillora</LinkButton>
          <LinkButton href="/search" icon="search">Search Skillora</LinkButton>
        </>}
      />
    </main>
  );
}
