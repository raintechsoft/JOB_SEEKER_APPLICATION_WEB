import { commit, getDb } from "@/mocks/store/demo-db";
import type { AdminService } from "./admin.service";

export const mockAdminService: AdminService = {
  async getOverview() {
    const db = getDb();
    return { professionals: 12, companies: 3, pendingVerification: db.companies.filter((c) => c.status === "Pending review").length, reportedContent: 0 };
  },

  async listProfessionals() {
    return getDb().professionals.map(({ id, name, headline, public: isPublic }) => ({ id, name, headline, public: isPublic }));
  },

  async toggleProfessionalVisibility(id) {
    return commit((db) => {
      const p = db.professionals.find((x) => x.id === id);
      if (p) p.public = !p.public;
    });
  },

  async listCompanies() {
    return getDb().companies.map(({ id, name, recruiter, status }) => ({ id, name, recruiter, status }));
  },

  async markCompanyVerified(id) {
    return commit((db) => {
      const c = db.companies.find((x) => x.id === id);
      if (c) c.status = "Demo verified";
    });
  },
};
