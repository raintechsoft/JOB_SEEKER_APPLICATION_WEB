import { LinkButton } from "@/components/ui/primitives";
import { StatePanel } from "@/components/ui/state-panel";

export default function AccessDeniedPage() {
  return (
    <main id="main" className="container section state-page">
      <StatePanel
        role="alert"
        icon="lock"
        tone="warning"
        title="You don’t have access to this workspace"
        description="This account isn’t set up for that area. Switch to a workspace you can use, or sign in with a different account."
        actions={
          <>
            <LinkButton href="/" variant="primary" icon="home">
              Back to Skillora
            </LinkButton>
            <LinkButton href="/login">Sign in</LinkButton>
          </>
        }
      />
    </main>
  );
}
