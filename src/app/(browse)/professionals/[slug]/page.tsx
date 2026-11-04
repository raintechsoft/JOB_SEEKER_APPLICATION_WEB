import { PublicCandidateScreen } from "@/features/talent/candidate-screen";

/** Shared profile links open inside the public browsing section (guest header and navigation). */
export default async function ProfessionalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicCandidateScreen slug={slug} embedded />;
}
