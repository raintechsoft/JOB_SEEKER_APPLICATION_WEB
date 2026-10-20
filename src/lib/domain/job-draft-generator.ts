/**
 * Template-based job draft generator ("Create with AI" in the job wizard).
 *
 * This is NOT a model: it picks a role family by keyword and fills role-based templates, exactly as
 * the prototype does. The UI labels it "Demo generator · Role-based templates".
 */
import type { ScreeningQuestion } from "@/types/domain";

interface RoleFamily {
  test: RegExp;
  department: string;
  skills: string[];
  focus: string;
  tasks: string[];
  evidence: string;
}

const FAMILIES: RoleFamily[] = [
  { test: /designer|design|ux|ui|creative/i, department: "Design", skills: ["Design thinking", "User research", "Prototyping", "Visual communication", "Design systems"], focus: "create clear, useful experiences that meet user and business needs", tasks: ["Understand user needs and translate findings into design decisions.", "Develop and iterate on concepts, prototypes, and design deliverables.", "Collaborate with product and engineering teams to improve usability.", "Present design choices and incorporate constructive feedback."], evidence: "a design decision you made and how you evaluated its impact" },
  { test: /data|analyst|analytics|scientist|machine learning/i, department: "Data & analytics", skills: ["Data analysis", "SQL", "Data quality", "Reporting", "Problem solving"], focus: "turn reliable data into useful insights and informed decisions", tasks: ["Collect, validate, and analyze data relevant to team goals.", "Create clear reports and communicate findings to stakeholders.", "Investigate trends, check assumptions, and document analytical methods.", "Work with cross-functional teams to improve data quality and decision-making."], evidence: "an analysis you completed and how its findings were used" },
  { test: /engineer|developer|programmer|software|devops|frontend|backend|full.?stack/i, department: "Engineering", skills: ["Software development", "Version control", "Testing", "Code review", "Problem solving"], focus: "build and maintain reliable software that solves practical user problems", tasks: ["Implement and maintain software in line with agreed requirements.", "Write tests, review code, and investigate defects.", "Collaborate with design, product, and engineering partners.", "Document technical decisions and improve performance and reliability."], evidence: "a technical problem you solved and the trade-offs you considered" },
  { test: /sales|retail|merchandis|showroom|account executive|business development/i, department: "Sales & retail", skills: ["Sales", "Customer communication", "Relationship management", "CRM", "Negotiation"], focus: "understand customer needs and support sustainable sales growth", tasks: ["Understand customer requirements and recommend relevant solutions.", "Manage leads, follow-ups, and customer relationships.", "Maintain accurate sales records and report progress.", "Coordinate with internal teams to improve the customer experience."], evidence: "a customer conversation or sales opportunity you managed" },
  { test: /marketing|content|seo|growth|copywriter|social media/i, department: "Marketing", skills: ["Content planning", "Audience research", "Campaign management", "Analytics", "Communication"], focus: "develop relevant campaigns and content that connect with the intended audience", tasks: ["Plan and produce content or campaigns aligned with team goals.", "Research audience needs and identify relevant opportunities.", "Track results and use evidence to improve future work.", "Coordinate with creative, product, and commercial stakeholders."], evidence: "a campaign or piece of content you improved using results" },
  { test: /human resources|recruiter|recruitment|talent|\bhr\b/i, department: "Human resources", skills: ["Recruitment", "Stakeholder communication", "Interview coordination", "Record keeping", "Confidentiality"], focus: "support consistent people processes and a thoughtful candidate and employee experience", tasks: ["Coordinate role requirements and communicate with hiring stakeholders.", "Support sourcing, screening, and interview coordination.", "Keep accurate records and handle personal information carefully.", "Improve candidate communication and follow-up processes."], evidence: "a hiring or people-process challenge you helped resolve" },
  { test: /finance|accountant|accounting|audit|bookkeep/i, department: "Finance", skills: ["Financial reporting", "Reconciliation", "Spreadsheet analysis", "Attention to detail", "Documentation"], focus: "maintain accurate financial information and support sound business decisions", tasks: ["Prepare and reconcile financial records relevant to the role.", "Investigate discrepancies and document supporting information.", "Support reporting, planning, and internal review activities.", "Coordinate with stakeholders to improve the accuracy of financial processes."], evidence: "a financial discrepancy or reporting challenge you resolved" },
  { test: /product manager|product owner/i, department: "Product", skills: ["Product discovery", "Prioritization", "Stakeholder communication", "Roadmap planning", "Analytics"], focus: "identify user problems and help teams deliver valuable product outcomes", tasks: ["Understand user needs and define clear product priorities.", "Translate goals into actionable requirements with the delivery team.", "Coordinate feedback, releases, and stakeholder communication.", "Use qualitative and quantitative evidence to evaluate outcomes."], evidence: "a product priority you set and how you evaluated the outcome" },
  { test: /operations|supply chain|logistics|warehouse|administrat/i, department: "Operations", skills: ["Operations planning", "Process improvement", "Coordination", "Reporting", "Problem solving"], focus: "keep day-to-day operations organized and improve the quality of delivery", tasks: ["Coordinate daily activities and maintain accurate operational records.", "Identify bottlenecks and suggest practical process improvements.", "Track delivery commitments and communicate issues promptly.", "Collaborate with internal and external stakeholders to resolve problems."], evidence: "an operational process you helped improve" },
  { test: /.*/, department: "Other", skills: ["Role-specific expertise", "Communication", "Planning", "Problem solving", "Teamwork"], focus: "deliver dependable work and collaborate effectively with the wider team", tasks: ["Deliver the responsibilities agreed for the role to a consistent standard.", "Coordinate priorities and communicate progress with relevant stakeholders.", "Identify practical improvements and resolve day-to-day problems.", "Maintain clear documentation and share relevant knowledge with the team."], evidence: "a relevant piece of work and the result you achieved" },
];

export interface JobBrief {
  role: string;
  experienceMin: string;
  experienceMax: string;
  salaryMin: string;
  salaryMax: string;
  currency: "INR" | "USD" | "EUR" | "GBP";
  location: string;
  arrangement: string;
  employment: string;
  skills: string;
  hideSalary: boolean;
}

export function draftJobFromBrief(brief: JobBrief) {
  const family = FAMILIES.find((f) => f.test.test(brief.role)) ?? FAMILIES[FAMILIES.length - 1];
  const experience =
    brief.experienceMin === "0"
      ? brief.experienceMax === "0"
        ? "No previous professional experience is required."
        : "Open to candidates with 0–" + brief.experienceMax + " years of relevant experience."
      : brief.experienceMin + "–" + brief.experienceMax + " years of relevant experience.";
  const skills = brief.skills
    ? brief.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((s, i, a) => a.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i)
        .slice(0, 15)
    : [...family.skills];
  for (const [pattern, skill] of [[/react/i, "React"], [/python/i, "Python"], [/java\b/i, "Java"], [/figma/i, "Figma"], [/node/i, "Node.js"]] as const) {
    if (pattern.test(brief.role) && !skills.includes(skill)) skills.unshift(skill);
  }
  const symbol = { INR: "₹", USD: "$", EUR: "€", GBP: "£" }[brief.currency];
  const compensation = symbol + brief.salaryMin + "–" + brief.salaryMax + (brief.currency === "INR" ? " LPA" : " per year");
  const questions: Omit<ScreeningQuestion, "id">[] = [
    { text: "How many years of relevant experience do you have for this " + brief.role + " role?", type: "number", required: false, ideal: brief.experienceMin },
    { text: "Briefly describe " + family.evidence + ".", type: "text", required: false, ideal: "" },
  ];
  return {
    title: brief.role,
    role: brief.role,
    department: family.department,
    experienceMin: brief.experienceMin,
    experienceMax: brief.experienceMax,
    salaryMin: brief.salaryMin,
    salaryMax: brief.salaryMax,
    currency: brief.currency,
    arrangement: brief.arrangement,
    employment: brief.employment,
    locations: brief.location
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean),
    skills,
    essentialSkills: skills.slice(0, Math.min(3, skills.length)),
    education: ["Any qualification"],
    industries: [] as string[],
    description: `We are looking for a ${brief.role} to ${family.focus}.\n\n${experience} This is a ${brief.employment.toLowerCase()} opportunity based in ${brief.location}, with a ${brief.arrangement.toLowerCase()} work arrangement.\n\n${brief.hideSalary ? "" : "The annual salary range for this role is " + compensation + ". "}You will work with colleagues to understand priorities, deliver thoughtful work, and improve outcomes.`,
    responsibilities: family.tasks.join("\n"),
    requirements: [experience, "Practical knowledge of " + skills.slice(0, 3).join(", ") + ".", "Ability to communicate clearly and collaborate with relevant stakeholders.", "Ability to explain your approach, learn from feedback, and deliver agreed work."].join("\n"),
    questions,
  };
}
