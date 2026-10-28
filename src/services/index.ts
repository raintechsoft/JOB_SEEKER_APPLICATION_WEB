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
import type { AuthService } from "./auth/auth.service";
import { createHttpServices } from "./http-services";
import type { SearchService } from "./search/search.service";
import { mockSearchService } from "./search/search.mock";
import type { MediaService } from "./media/media.http";
import type {NotificationsService} from "./notifications/notifications.service";
import type { JourneyService } from "./journey/journey.service";
import { mockJourneyService } from "./journey/journey.mock";

/** Every data-access boundary the UI uses. */
export interface Services {
  journey: JourneyService;
  search: SearchService;
  analytics:Pick<ReturnType<typeof import("./analytics/analytics.http").createHttpAnalyticsService>,"getSettings"|"setConsent">;
  notifications:NotificationsService;
  media: MediaService;
  auth: AuthService;
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
  journey: mockJourneyService,
  search: mockSearchService,
  analytics:{async getSettings(){return {available:false,granted:false,hasStoredConsent:false,policyVersion:"",retentionDays:0,version:0};},async setConsent(){throw new Error("Analytics consent requires HTTP mode.");}},
  media: { async upload() { throw new Error("Managed uploads require HTTP mode."); }, async remove() { throw new Error("Managed uploads require HTTP mode."); } },
  auth: new Proxy({} as AuthService, { get: () => async () => { throw new Error("Real account operations require HTTP mode."); } }),
  activity: mockActivityService,
  notifications:{async list(){return {items:[],unreadCount:0,newCount:0,seenToken:"mock"};},async counts(){return {unreadCount:0,newCount:0};},async markSeen(){},async delete(){},async markRead(){},async preferences(){return [];},async savePreference(){}},
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
    return createHttpServices(apiConfig.baseUrl);
  }
  return mockServices;
}
