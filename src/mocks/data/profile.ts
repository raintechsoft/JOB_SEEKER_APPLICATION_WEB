import type { Professional, ProfessionalDetails } from "@/types/domain";
import { uid } from "@/lib/utils/id";

/** Builds the structured profile from the flat professional record (prototype `ensureProfile`). */
export function buildProfessionalDetails(p: Professional): ProfessionalDetails {
  const role = p.experience.split(" at ");
  const edu = p.education.split(" · ");
  const company = (role[1] || "").split(" · ")[0];
  return {
    version: 1,
    updatedAt: "",
    phone: "",
    currentTitle: p.headline,
    currentCompany: company,
    employmentStatus: "Employed",
    focus: "",
    strengths: "",
    resume: null,
    skills: p.skills.map((name) => ({ id: uid(), name, category: "Other", level: "", years: "", featured: true })),
    employment: p.experience
      ? [{ id: uid(), title: role[0], company, type: "Full-time", arrangement: p.arrangement, location: p.location, start: "", end: "", current: true, description: "", responsibilities: "", achievements: "", skills: p.skills.slice(0, 2).join(", "), projects: [], public: true }]
      : [],
    education: p.education ? [{ id: uid(), degree: edu[0], institution: edu[1] || "", field: "", start: "", end: "", current: false, grade: "", description: "", coursework: "", type: "Full-time", public: true }] : [],
    technicalSkills: [],
    onlineProfiles: p.website ? [{ id: uid(), title: "Personal website", url: p.website, label: "", public: true }] : [],
    workSamples: [],
    publications: [],
    presentations: [],
    patents: [],
    certifications: [],
    career: { industry: "", department: "", category: "", currentType: "Full-time", roles: p.headline, industries: "", departments: "", types: "Full-time", locations: p.location, arrangement: p.arrangement, notice: "", salary: "", currency: "", interests: p.interests },
    personal: { gender: "", dob: "", marital: "", nationality: "", permit: "", address: "", city: "", region: "", country: "", postal: "", contact: "Email" },
    languages: [],
    diversity: { accessibility: "", military: "", context: "" },
    careerBreaks: [],
    privacy: { email: false, phone: false },
    photoRemoved: false,
  };
}
