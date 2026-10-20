import type { ActivityService } from "./activity/activity.service";
import { mockActivityService } from "./activity/activity.mock";
import type { AdminService } from "./admin/admin.service";
import { mockAdminService } from "./admin/admin.mock";
import { apiConfig } from "./api/config";
import type { ApplicationsService } from "./applications/applications.service";
import { mockApplicationsService } from "./applications/applications.mock";
import type { FeedService } from "./feed/feed.service";
import { mockFeedService } from "./feed/feed.mock";
import type { JobPostsService } from "./job-posts/job-posts.service";
import { mockJobPostsService } from "./job-posts/job-posts.mock";
import type { JobsService } from "./jobs/jobs.service";
import { mockJobsService } from "./jobs/jobs.mock";
import type { MessagingService } from "./messaging/messaging.service";
import { mockMessagingService } from "./messaging/messaging.mock";
import type { OnboardingService } from "./onboarding/onboarding.service";
import { mockOnboardingService } from "./onboarding/onboarding.mock";
import type { OrganizationService } from "./organization/organization.service";
import { mockOrganizationService } from "./organization/organization.mock";
import type { PortfolioService } from "./portfolio/portfolio.service";
import { mockPortfolioService } from "./portfolio/portfolio.mock";
import type { ProfileService } from "./profile/profile.service";
import { mockProfileService } from "./profile/profile.mock";
import type { RecommendationsService } from "./recommendations/recommendations.service";
import { mockRecommendationsService } from "./recommendations/recommendations.mock";
import type { RecruitingService } from "./recruiting/recruiting.service";
import { mockRecruitingService } from "./recruiting/recruiting.mock";
import type { RegistrationService } from "./registration/registration.service";
import { mockRegistrationService } from "./registration/registration.mock";
import type { TalentService } from "./talent/talent.service";
import { mockTalentService } from "./talent/talent.mock";
import type { WorkService } from "./work/work.service";
import { mockWorkService } from "./work/work.mock";
import type { WorkspaceService } from "./workspace/workspace.service";
import { mockWorkspaceService } from "./workspace/workspace.mock";

/** Every data-access boundary the UI uses. */
export interface Services {
  activity: ActivityService;
  admin: AdminService;
  applications: ApplicationsService;
  feed: FeedService;
  jobPosts: JobPostsService;
  jobs: JobsService;
  messaging: MessagingService;
  onboarding: OnboardingService;
  organization: OrganizationService;
  portfolio: PortfolioService;
  profile: ProfileService;
  recommendations: RecommendationsService;
  recruiting: RecruitingService;
  registration: RegistrationService;
  talent: TalentService;
  work: WorkService;
  workspace: WorkspaceService;
}

/** MOCK: browser-local implementations backed by `src/mocks`. */
const mockServices: Services = {
  activity: mockActivityService,
  admin: mockAdminService,
  applications: mockApplicationsService,
  feed: mockFeedService,
  jobPosts: mockJobPostsService,
  jobs: mockJobsService,
  messaging: mockMessagingService,
  onboarding: mockOnboardingService,
  organization: mockOrganizationService,
  portfolio: mockPortfolioService,
  profile: mockProfileService,
  recommendations: mockRecommendationsService,
  recruiting: mockRecruitingService,
  registration: mockRegistrationService,
  talent: mockTalentService,
  work: mockWorkService,
  workspace: mockWorkspaceService,
};

export function createServices(): Services {
  if (apiConfig.dataSource === "http") {
    // HTTP implementations are added per domain as the NestJS endpoints become available.
    // Until then, fail loudly instead of silently falling back to fake data.
    throw new Error("NEXT_PUBLIC_DATA_SOURCE=http is not implemented yet. See docs/frontend-architecture.md#backend-integration.");
  }
  return mockServices;
}
