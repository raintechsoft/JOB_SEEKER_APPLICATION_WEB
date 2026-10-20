import type { Job, Post, SampleApplication } from "@/types/domain";
import { hoursAgo } from "@/lib/utils/date";

export function seedJobs(): Job[] {
  return [
    {
      id: "job-design",
      company: "c0",
      title: "Product Designer",
      team: "Product & design",
      location: "Bengaluru, India",
      arrangement: "Hybrid",
      employment: "Full-time",
      salary: "₹18–26 LPA",
      skills: ["Product design", "Figma", "Design systems"],
      description: "Good products start with people who care. We’re looking for a Product Designer who can turn complex problems into thoughtful, human experiences.",
      responsibilities: ["Own product experiences from early exploration to the final details.", "Partner with engineering and research to make considered decisions.", "Help shape an accessible, evolving design system."],
      requirements: "3+ years of product design experience, a portfolio that shows your process, and a collaborative approach.",
      createdAt: hoursAgo(1),
      likes: 24,
      art: "northstar",
    },
    {
      id: "job-engineer",
      company: "c1",
      title: "Frontend Engineer",
      team: "Engineering",
      location: "Remote, India",
      arrangement: "Remote",
      employment: "Full-time",
      salary: "₹16–24 LPA",
      skills: ["React", "TypeScript", "Accessibility"],
      description: "Help us build interfaces that feel effortless. We’re growing a small, collaborative engineering team with a love for accessible, well-crafted web experiences.",
      responsibilities: ["Build responsive product experiences in React and TypeScript.", "Collaborate closely with designers and product partners.", "Make performance and accessibility part of everyday development."],
      requirements: "3+ years building web applications and examples of thoughtful frontend craft.",
      createdAt: hoursAgo(8),
      likes: 18,
      art: "meridian",
    },
    {
      id: "job-brand",
      company: "c2",
      title: "Brand & Visual Designer",
      team: "Brand studio",
      location: "Mumbai, India",
      arrangement: "Hybrid",
      employment: "Full-time",
      salary: "₹12–18 LPA",
      skills: ["Brand strategy", "Typography", "Illustration"],
      description: "Bring a fresh perspective to a growing independent studio. We’re looking for someone who thinks in stories, systems, and all the small details in between.",
      responsibilities: ["Develop identities and visual systems with a clear point of view.", "Explore typography, art direction, and digital brand experiences.", "Collaborate with strategy and product teams."],
      requirements: "A considered visual portfolio, 3+ years of relevant experience, and curiosity about the world.",
      createdAt: hoursAgo(24),
      likes: 12,
      art: "forma",
    },
  ];
}

export function seedPosts(): Post[] {
  return [
    { id: "post-maya", owner: "p3", title: "A new chapter for Sunday Studio.", body: "Some projects remind you why you fell in love with making things.\n\nSharing a first look at the visual identity we’ve been shaping for Sunday Studio — warm colors, expressive typography, and a little room to play. The best part? Building it with people who care about the details.\n\nWhat’s one brand detail you always notice?", media: "brand", image: "", project: "proj4", createdAt: hoursAgo(3), likes: 46, kind: "Project showcase" },
    { id: "post-priya", owner: "p1", title: "Built with everyone in mind.", body: "This week’s small win: our component library is now fully keyboard navigable.\n\nIt took a lot of testing, a few assumptions challenged, and a reminder that accessibility is a practice, not a final checkbox. Sharing a few notes from the process.", media: "code", image: "", project: "proj2", createdAt: hoursAgo(5), likes: 32, kind: "Work update" },
    { id: "post-theo", owner: "p6", title: "Sometimes the best design tool is a good question.", body: "Wrapped up a round of discovery interviews today. The most useful insight wasn’t a feature request — it was understanding what people were trying to feel confident about.\n\nA reminder to leave space for the unexpected answer.", media: "", image: "", project: "", createdAt: hoursAgo(16), likes: 19, kind: "From the process" },
  ];
}

export function seedSampleApplications(): SampleApplication[] {
  return [
    { id: "received-alex", job: "job-design", candidate: "p0", createdAt: hoursAgo(6), sample: true, note: "I would love to bring my product design and research experience to your team.", portfolio: true },
    { id: "received-maya", job: "job-design", candidate: "p3", createdAt: hoursAgo(24), sample: true, note: "Sharing my recent design work and visual systems experience.", portfolio: true },
    { id: "received-theo", job: "job-design", candidate: "p6", createdAt: hoursAgo(48), sample: true, note: "Interested in bringing a research-led perspective to product design.", portfolio: true },
  ];
}
