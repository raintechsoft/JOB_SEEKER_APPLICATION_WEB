import { EmptyState, LinkButton } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <main id="main" className="container section">
      <EmptyState
        title="This chapter hasn’t been written."
        description="That page could not be found."
        action={
          <LinkButton href="/" variant="primary">
            Back to Skillora
          </LinkButton>
        }
      />
    </main>
  );
}
