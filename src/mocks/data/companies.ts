import type { Company, Conversation, Professional, Shortlist } from "@/types/domain";
import { dateAgo } from "@/lib/utils/date";

export function seedCompanies(): Company[] {
  return [
    { id: "c0", name: "Northstar Labs", industry: "Product & technology", website: "https://example.com", summary: "Building thoughtful digital products for a better everyday.", recruiter: "Emma Wilson", email: "emma@northstar.example", title: "Talent Partner", interests: "Design, Engineering, Product", status: "Not verified" },
    { id: "c1", name: "Meridian", status: "Pending review", recruiter: "Daniel Brooks" },
    { id: "c2", name: "Forma Studio", status: "Not verified", recruiter: "Riya Patel" },
  ];
}

export function seedConversations(professionals: Professional[], companies: Company[]): Conversation[] {
  return ["Emma Wilson", "Daniel Brooks", "Riya Patel", "Jamie Carter"].map((name, i) => ({
    id: "conv" + i,
    name,
    candidate: "p" + i,
    company: companies[i % 3].name,
    unread: i < 2,
    messages: [
      { text: "Hi " + professionals[i].name.split(" ")[0] + ", I came across your work and really enjoyed the thinking behind your projects.", sender: "recruiter", time: dateAgo(1) + "T10:30:00" },
      { text: "Thanks for reaching out! Happy to share more about my process and explore the opportunity.", sender: "professional", time: dateAgo(1) + "T11:05:00" },
      { text: "That sounds great. Would you be open to a conversation about our product team?", sender: "recruiter", time: dateAgo(0) + "T09:15:00" },
    ],
  }));
}

export function seedShortlists(): Shortlist[] {
  return [
    { id: "s0", name: "Product Designers", candidates: ["p0", "p3", "p9"] },
    { id: "s1", name: "Frontend Developers", candidates: ["p1", "p4"] },
    { id: "s2", name: "People to connect with", candidates: ["p2", "p5"] },
  ];
}
