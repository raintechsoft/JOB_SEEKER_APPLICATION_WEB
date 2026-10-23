import { PublicCandidateScreen } from "@/features/talent/candidate-screen";

export default async function ProfessionalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicCandidateScreen slug={slug} />;
}
