import { notFound } from "next/navigation";
import { AdminScreen, type AdminPage } from "@/features/admin/admin-screen";

const PAGES: AdminPage[] = ["dashboard", "users", "companies", "moderation", "quality"];

export function generateStaticParams() {
  return PAGES.map((page) => ({ page }));
}

export default async function Page({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!PAGES.includes(page as AdminPage)) notFound();
  return <AdminScreen page={page as AdminPage} />;
}
