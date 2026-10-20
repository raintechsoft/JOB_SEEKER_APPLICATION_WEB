import type { DemoDatabase, PortfolioConfig } from "@/types/domain";
import { seedCompanies, seedConversations, seedShortlists } from "./data/companies";
import { seedJobs, seedPosts, seedSampleApplications } from "./data/feed";
import { seedOrganizationWorkspace } from "./data/organization";
import { seedProfessionals } from "./data/professionals";
import { seedProjects, seedUpdates } from "./data/projects";

export const PORTFOLIO_SECTIONS = ["Introduction", "About", "Skills & expertise", "Featured projects", "Experience", "Work updates", "Education", "Contact"];

/**
 * Fresh demo database. Dates are relative to "now", as in the prototype, so the demo always looks
 * recent. All people, companies and jobs are fictional.
 */
export function createSeed(): DemoDatabase {
  const professionals = seedProfessionals();
  const companies = seedCompanies();
  const portfolios = Object.fromEntries(
    professionals.map((p): [string, PortfolioConfig] => [
      p.id,
      { title: p.name, headline: p.headline, slug: p.slug, theme: "#5146e5", public: true, sections: PORTFOLIO_SECTIONS.map((name) => ({ name, visible: true })), expiry: "", otp: false },
    ]),
  );
  return {
    schema: 1,
    social: {
      following: ["p1", "p3", "p6"],
      followingCompanies: ["c0"],
      liked: [],
      saved: [],
      reactionDates: {},
      followers: ["p1", "p2", "p6"],
      comments: {},
      applications: [],
      jobs: seedJobs(),
      posts: seedPosts(),
      // The prototype's first alert follows the professional's current headline.
      jobAlerts: [{ id: "alert-my-role", name: professionals[0].headline, keywords: professionals[0].headline, location: "", arrangement: "Any", days: 7, enabled: true }],
      seenJobs: [],
    },
    recruiterSocial: { following: ["p0", "p1", "p3", "p6"], followingCompanies: [], liked: [], saved: [], reactionDates: {}, followers: ["p2", "p4", "p7"] },
    professionals,
    projects: seedProjects(professionals),
    updates: seedUpdates(),
    companies,
    conversations: seedConversations(professionals, companies),
    shortlists: seedShortlists(),
    portfolios,
    settings: { notifications: true, updatesPublic: true },
    session: null,
    recruiter: { tracking: {}, sampleApplications: seedSampleApplications(), responseOutreach: [] },
    organizationWorkspace: seedOrganizationWorkspace(companies[0]),
    employerRegistrations: [],
    postEditorDrafts: {},
    jobEditorDrafts: {},
  };
}
