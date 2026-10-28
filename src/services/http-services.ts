import {createHttpRecommendationsService} from "./recommendations/recommendations.http";
import {createHttpAnalyticsService} from "./analytics/analytics.http";
import type { Services } from "./index";
import { createHttpClient } from "./api/client";
import { createHttpAuthService } from "./auth/auth.http";
import { createMediaService } from "./media/media.http";
import {uploadManager} from "./media/upload-manager";
import { createHttpProfileService } from "./profile/profile.http";
import { createHttpOrganizationService } from "./organization/organization.http";
import { createHttpOnboardingService } from "./onboarding/onboarding.http";
import { createHttpWorkService } from "./work/work.http";
import { createHttpPortfolioService } from "./portfolio/portfolio.http";
import { createHttpJobPostsService } from "./job-posts/job-posts.http";
import { createHttpFeedService } from "./feed/feed.http";
import {createHttpMessagingService} from "./messaging/messaging.http";
import {createHttpNotificationsService} from "./notifications/notifications.http";
import {createHttpSettingsService} from "./workspace/settings.http";
import {createHttpAdminService} from "./admin/admin.http";
import { createHttpJobsService } from "./jobs/jobs.http";
import { createHttpApplicationsService } from "./applications/applications.http";
import { createHttpRecruitingService } from "./recruiting/recruiting.http";
import { createHttpTalentService } from "./talent/talent.http";
import { createHttpSearchService } from "./search/search.http";
import { createHttpJourneyService } from "./journey/journey.http";


/** Enable completed real domains; unimplemented domains never fall back to fixtures. */
export function createHttpServices(baseUrl: string): Services {
  if (!baseUrl) throw new Error("Set NEXT_PUBLIC_API_BASE_URL for real API mode.");
  const endpoint=new URL(baseUrl);
  if(!["http:","https:"].includes(endpoint.protocol)||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||!/^\/api\/v1\/?$/.test(endpoint.pathname))throw new Error("Configure an absolute API v1 URL without credentials or query parameters.");
  const localRehearsal=process.env.NEXT_PUBLIC_LOCAL_STAGING_REHEARSAL==="true"&&["127.0.0.1","localhost"].includes(endpoint.hostname);
  if(process.env.NEXT_PUBLIC_APP_ENV==="production"&&endpoint.protocol!=="https:"&&!localRehearsal)throw new Error("Production API traffic requires HTTPS.");
  const unavailable = new Proxy({}, {
    get: (_target, method) => method === "then" ? undefined : async () => { throw new Error("This prototype-only operation is unavailable in real API mode."); },
  });
  const http = createHttpClient(baseUrl);
  const analytics=createHttpAnalyticsService(http);
  const auth = createHttpAuthService(http, () => { uploadManager.clear(); profile.reset(); work.reset(); portfolio.reset(); jobPosts.reset(); jobs.reset(); applications.reset(); recruiting.reset(); talent.reset(); social.reset(); messaging.reset(); settings.reset();analytics.reset(); },session=>{void analytics.attach(session);});
  const media = createMediaService(http, () => auth.me());
  const work = createHttpWorkService(http, media);
  const profile = createHttpProfileService(http, media, (id, offset) => work.moveProject(id, offset));
  const portfolio = createHttpPortfolioService(http);
  const organization = createHttpOrganizationService(http, auth);
  const onboarding = createHttpOnboardingService(http, () => profile.reset());
  const settings=createHttpSettingsService(http);
  const workspace = new Proxy({}, {
    get: (_target, method) => {
      if (method === "getSession") return async () => { const session = await auth.me(); return { role: session.workspaces.find((w) => w.id === session.selected_identity_id)?.kind ?? "professional" }; };
      if (method === "signOut") return () => auth.logout();
      if(method==="getSettings")return settings.getSettings;
      if(method==="updateSetting")return settings.updateSetting;
      if (method === "getProfessionalShell") return async () => { const { person } = await profile.getProfile(); return { person }; };
      if (method === "getProfessionalSummary") return async () => { const { person } = await profile.getProfile(); return { person }; };
      if (method === "getRecruiterShell") return async () => { const ctx = await organization.getContext(); const member = ctx.currentRecruiter; return { identity: { id: member.id, name: member.fullName, picture: member.avatarUrl, color: "#246b53" }, companyName: ctx.workspace.organization.name, title: member.jobTitle, email: member.workEmail }; };
      if (method === "getHomeCompany") return async () => { const ctx = await organization.getContext(); const o = ctx.workspace.organization, r = ctx.currentRecruiter; return { id: o.id, name: o.name, industry: o.industry, website: o.websiteUrl, summary: o.description, recruiter: r.fullName, email: r.workEmail, title: r.jobTitle, interests: r.hiringDepartments.join(", "), status: o.verificationStatus }; };
      return Reflect.get(unavailable, method);
    },
  });
  const social = createHttpFeedService(http,auth);
  const messaging=createHttpMessagingService(http,auth);
  const notifications=createHttpNotificationsService(http,auth);
  const admin=createHttpAdminService(http);
  const jobPosts = { ...createHttpJobPostsService(http,auth), getPostDraft: social.getPostDraft, storePostDraft: social.storePostDraft };
  const jobs = createHttpJobsService(http);
  const applications = createHttpApplicationsService(http);
  const recruiting = createHttpRecruitingService(http,auth);
  const recommendations=createHttpRecommendationsService(http,auth);
  const talent = createHttpTalentService(http,auth,()=>recommendations.talent(),()=>messaging.getInbox("recruiter",{q:"",filter:"all",selectedId:null}));
  const search = createHttpSearchService(http, auth);
  const enabled = { journey:createHttpJourneyService(http,media), search, analytics,auth, media, profile, organization, onboarding, workspace, talent, work, portfolio, jobPosts, jobs, applications, recruiting, feed: social.feed, activity: social.activity, recommendations, messaging, notifications, admin };
  return new Proxy(enabled, {
    get: (target, property) => Object.hasOwn(target, property) ? Reflect.get(target, property) : unavailable,
  }) as unknown as Services;
}
