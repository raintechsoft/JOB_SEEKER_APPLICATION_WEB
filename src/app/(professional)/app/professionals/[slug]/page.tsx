import { PublicCandidateScreen } from "@/features/talent/candidate-screen";
import { Icon } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/primitives";

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { slug } = await params;
  const { preview } = await searchParams;
  return <>
    {/* Previewing your own profile stays inside the workspace, with a way back to editing. */}
    {preview === "1" && (
      <div className="org-preview-banner">
        <div>
          <Icon name="eye" />
          <span>
            <strong>Public profile preview</strong>
          </span>
        </div>
        <LinkButton href="/app/profile" variant="sm" icon="edit">Back to editing</LinkButton>
      </div>
    )}
    <PublicCandidateScreen slug={slug} inWorkspace />
  </>;
}
