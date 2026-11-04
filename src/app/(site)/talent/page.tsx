import { redirect } from "next/navigation";

// The marketing talent directory is retired; people search covers it inside the app.
export default function TalentPage() {
  redirect("/search?scope=people");
}
