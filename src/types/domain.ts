/**
 * Domain model for the Skillora frontend.
 *
 * These types describe the records the UI works with. In this phase they are produced by the
 * browser-local mock backend (`src/mocks`); later they are the shape the HTTP API is expected to
 * return (see `src/services/api` and docs/frontend-architecture.md).
 */

export type Id = string;
/** Calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;
/** Full ISO-8601 timestamp. */
export type IsoDateTime = string;

export type Role = "professional" | "recruiter";
export type Visibility = "Public" | "Private";
export type Discipline = "Design" | "Engineering" | "Data" | "Business";
export type WorkArrangement = "Remote" | "Hybrid" | "On-site";
export type EmploymentType = "Full-time" | "Part-time" | "Contract" | "Internship";

// ---------------------------------------------------------------------------------------------
// People and work
// ---------------------------------------------------------------------------------------------

export interface Professional {
  id: Id;
  slug: string;
  name: string;
  headline: string;
  category: Discipline;
  location: string;
  years: number;
  skills: string[];
  summary: string;
  experience: string;
  education: string;
  interests: string;
  email: string;
  website: string;
  arrangement: string;
  available: boolean;
  /** Profile completion percentage. */
  complete: number;
  public: boolean;
  avatar: number;
  color: string;
  lastActive: IsoDate;
  /** Uploaded portrait (data URL). */
  picture?: string;
  professionalDetails?: ProfessionalDetails;
  locality?: string;
  industry?: string;
  department?: string;
}

export interface Project {
  version?: number;
  id: Id;
  owner: Id;
  title: string;
  description: string;
  category: Discipline;
  skills: string[];
  contribution: string;
  url: string;
  repository: string;
  start: IsoDate;
  date: IsoDate;
  visibility: Visibility;
  featured: boolean;
  /** Index of the illustrative artwork (0–4). */
  art: number;
  /** Uploaded cover image (data URL). */
  cover: string;
}

export type UpdateCategory = "Design" | "Development" | "Research" | "Learning" | "Marketing" | "Collaboration";

export interface WorkUpdate {
  version?: number;
  id: Id;
  owner: Id;
  title: string;
  description: string;
  category: string;
  skills: string[];
  project: Id | "";
  date: IsoDate;
  visibility: Visibility;
}

export type CompanyStatus = "Not verified" | "Pending review" | "Demo verified";

export interface Company {
  id: Id;
  name: string;
  industry?: string;
  website?: string;
  summary?: string;
  recruiter: string;
  email?: string;
  title?: string;
  interests?: string;
  status: CompanyStatus;
}

// ---------------------------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------------------------

export interface MediaItem {
  type: "image" | "video";
  src: string;
  alt: string;
  name: string;
  bytes?: number;
}

export interface Post {
  id: Id;
  owner: Id;
  title: string;
  body: string;
  /** Built-in illustrative artwork for seeded posts. */
  media: "" | "brand" | "code";
  image: string;
  imageAlt?: string;
  video?: string;
  attachments?: MediaItem[];
  project: Id | "";
  createdAt: IsoDateTime;
  editedAt?: IsoDateTime;
  likes: number;
  kind: string;
  visibility?: Visibility;
}

export interface Comment {
  version?: number;
  id: Id;
  owner: Id;
  text: string;
  createdAt: IsoDateTime;
  editedAt?: IsoDateTime;
}

export interface ScreeningQuestion {
  id: Id;
  text: string;
  type: "text" | "yesno" | "number";
  required: boolean;
  ideal: string;
}

export interface JobThumbnail {
  template: string;
  image: string;
  alt: string;
  headline: string;
}

export interface JobMediaFile {
  id: Id;
  name: string;
  type: string;
  size: number;
  data: string;
}

export interface JobMedia {
  video: string;
  files: JobMediaFile[];
}

export interface Job {
  version?: number;
  questionsVersion?: number;
  id: Id;
  company: Id;
  title: string;
  team?: string;
  location: string;
  arrangement: string;
  employment: string;
  salary: string;
  skills: string[];
  description: string;
  responsibilities: string[];
  requirements: string;
  createdAt: IsoDateTime;
  publishedAt?: IsoDateTime | null;
  likes: number;
  art: string;
  companyDisplayName?: string;
  hideCompany?: boolean;
  hideSalary?: boolean;
  department?: string;
  role?: string;
  benefits?: string;
  screeningQuestions?: ScreeningQuestion[];
  requirePortfolio?: boolean;
  applicationInstructions?: string;
  expiresAt?: IsoDate;
  reference?: string;
  postedBy?: string;
  draft?: boolean;
  closed?: boolean;
  thumbnail?: JobThumbnail;
  jobMedia?: JobMedia;
  wizardValues?: Partial<JobWizardValues>;
  workflowStep?: number;
  collaborators?: string[];
  collaborationNote?: string;
}

export interface RecruitmentDetails {
  location?: string;
  locality?: string;
  expectedSalaryLpa?: string;
  noticeDays?: string;
  joiningDays?: string;
  industry?: string;
  designation?: string;
  department?: string;
  preferredLocations?: string;
  phone?: string;
}

export type ApplicationStatus = "Applied" | "In review" | "Interview" | "Offer" | "Rejected" | "Withdrawn";

/** A job seeker's own (self-tracked) demo application. */
export interface SeekerApplication {
  version?: number;
  employerStage?: HiringStage;
  withdrawnAt?: string | null;
  id: Id;
  job: Id;
  name: string;
  email: string;
  note: string;
  portfolio: boolean;
  recruitmentDetails?: RecruitmentDetails;
  screeningAnswers?: { id: Id; question: string; answer: string }[];
  createdAt: IsoDateTime;
  status: ApplicationStatus;
  trackingNote: string;
  followUp: IsoDate | "";
  updatedAt?: IsoDateTime;
}

export interface JobAlert {
  id: Id;
  name: string;
  keywords: string;
  location: string;
  arrangement: "Any" | WorkArrangement;
  days: number;
  enabled: boolean;
}

export interface SocialGraph {
  following: Id[];
  followingCompanies: Id[];
  liked: Id[];
  saved: Id[];
  reactionDates: Record<Id, IsoDateTime>;
  followers: Id[];
}

/** Shared social content plus the professional's own graph. */
export interface SocialData extends SocialGraph {
  comments: Record<Id, Comment[]>;
  applications: SeekerApplication[];
  jobs: Job[];
  posts: Post[];
  jobAlerts: JobAlert[];
  seenJobs: Id[];
}

// ---------------------------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------------------------

export interface MessageAttachment {
  id: Id;
  name: string;
  type: string;
  size: number;
  data: string;
  image: boolean;
}

export interface Message {
  id?: Id;
  text: string;
  sender: Role;
  time: IsoDateTime;
  attachments?: MessageAttachment[];
}

export interface Conversation {
  id: Id;
  name: string;
  candidate: Id;
  company: string;
  unread: boolean;
  messages: Message[];
  starredBy?: Role[];
  archivedBy?: Role[];
  deletedBy?: Role[];
  mutedBy?: Role[];
  blockedBy?: Role[];
  jobLabelBy?: Role[];
  reports?: { role: Role; reason: string; details: string; time: IsoDateTime }[];
}

// ---------------------------------------------------------------------------------------------
// Talent and portfolio
// ---------------------------------------------------------------------------------------------

export interface Shortlist {
  version?: number;
  visibility?: "private"|"organization";
  canEdit?: boolean;
  id: Id;
  name: string;
  candidates: Id[];
}

export interface PortfolioSection {
  name: string;
  visible: boolean;
}

export interface PortfolioConfig {
  version?: number;
  title: string;
  headline: string;
  slug: string;
  theme: string;
  public: boolean;
  sections: PortfolioSection[];
  expiry: IsoDate | "";
  otp: boolean;
}

// ---------------------------------------------------------------------------------------------
// Recruiting
// ---------------------------------------------------------------------------------------------

export type HiringStage = "New" | "Reviewing" | "Shortlisted" | "Interview" | "Hired" | "Rejected";

export interface ApplicationTracking {
  status?: HiringStage;
  note?: string;
  followUp?: IsoDate | "";
  viewedAt?: IsoDateTime;
  removed?: boolean;
  updatedAt?: IsoDateTime;
  matchRun?: { terms: string[]; score: number; at: IsoDateTime };
}

export interface SampleApplication {
  id: Id;
  job: Id;
  candidate: Id;
  createdAt: IsoDateTime;
  sample: true;
  note: string;
  portfolio: boolean;
}

export interface OutreachDraft {
  id: Id;
  responses: Id[];
  subject: string;
  message: string;
  createdAt: IsoDateTime;
}

export interface RecruiterData {
  tracking: Record<Id, ApplicationTracking>;
  sampleApplications: SampleApplication[];
  responseOutreach: OutreachDraft[];
}

/** An application as seen from the recruiter's inbox. */
export interface ReceivedApplication {
  history?: {id:Id;kind:"stage"|"note";author:string;createdAt:IsoDateTime;from?:HiringStage;to?:HiringStage;body?:string}[];
  version?: number;
  withdrawnAt?: string | null;
  id: Id;
  job: Id;
  candidate: Id;
  createdAt: IsoDateTime;
  sample?: boolean;
  name?: string;
  email?: string;
  note: string;
  portfolio: boolean;
  recruitmentDetails?: RecruitmentDetails;
  screeningAnswers?: { id: Id; question: string; answer: string }[];
  resumeText?: string;
  status: HiringStage;
  recruiterNote: string;
  followUp: string;
  viewedAt: string;
}

// ---------------------------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------------------------

export type VerificationStatus = "Not started" | "In progress" | "Pending review" | "Verified" | "Action required";
export type OrganizationRole = "Organization Admin" | "Recruiter" | "Hiring Manager";
export type AccountStatus = "Active" | "Inactive" | "Invitation Pending";

export interface WorkplaceImage {
  id: Id;
  url: string;
  alt: string;
  bytes: number;
}

export interface Organization {
  version?: number;
  id: Id;
  name: string;
  slug: string;
  logoUrl: string;
  coverImageUrl: string;
  tagline: string;
  industry: string;
  organizationType: string;
  companySize: string;
  foundingYear: string;
  headquartersCountry: string;
  headquartersCity: string;
  websiteUrl: string;
  description: string;
  overview: string;
  mission: string;
  vision: string;
  productsAndServices: string;
  expertiseAreas: string[];
  cultureDescription: string;
  candidateExpectations: string;
  workEnvironment: string;
  workModes: string[];
  workplaceLocations: string[];
  benefits: string[];
  cultureHighlights: string;
  workplaceImages: WorkplaceImage[];
  hiringStatus: string;
  hiringDepartments: string[];
  hiringLocations: string[];
  employmentTypes: string[];
  careersUrl: string;
  applicationContact: string;
  publicContactEmail: string;
  publicPhone: string;
  socialLinks: { linkedin: string; other: string };
  profileVisibility: "Public" | "Hidden";
  showPublicContact: boolean;
  showCareers: boolean;
  acceptInquiries: boolean;
  notifyApplications: boolean;
  notifyTeam: boolean;
  weeklyDigest: boolean;
  verificationStatus: VerificationStatus;
  updatedAt?: IsoDateTime;
  companyAddress?: string;
  pincode?: string;
  hiringFor?: string;
}

export interface RecruiterMember {
  version?: number;
  id: Id;
  organizationId: Id;
  fullName: string;
  avatarUrl: string;
  jobTitle: string;
  professionalBio: string;
  workEmail: string;
  hiringDepartments: string[];
  hiringLocations: string[];
  professionalLinks: { linkedin: string };
  role: OrganizationRole;
  accountStatus: "Active" | "Inactive";
  profileVisibility: "Public" | "Hidden";
  communicationPreference: string;
  privateMobile?: string;
  accountType?: string;
}

export interface Invitation {
  id: Id;
  organizationId: Id;
  fullName: string;
  email: string;
  role: OrganizationRole;
  hiringDepartment: string;
  invitationStatus: "Invitation Pending" | "Accepted" | "Cancelled";
  createdAt: IsoDateTime;
  reminderAt?: IsoDateTime;
}

export interface VerificationDocument {
  id: Id;
  name: string;
  size: number;
  type: string;
}

export interface Verification {
  registrationName: string;
  registrationNumber: string;
  jurisdiction: string;
  representative: string;
  representativeTitle: string;
  businessEmail: string;
  website: string;
  documents: VerificationDocument[];
  submittedAt: IsoDateTime | "";
  reviewNote: string;
}

export interface OrganizationWorkspace {
  organization: Organization;
  recruiters: RecruiterMember[];
  invitations: Invitation[];
  verification: Verification;
  currentRecruiterId: Id;
}

export interface EmployerRegistrationRecord {
  id: Id;
  fullName: string;
  email: string;
  mobile: string;
  company: string;
  accountType: string;
  verificationMode: "demo";
  mobileVerified: boolean;
  emailVerified: boolean;
  createdAt: IsoDateTime;
}

// ---------------------------------------------------------------------------------------------
// Professional profile details
// ---------------------------------------------------------------------------------------------

export interface ProfileSkill {
  id: Id;
  name: string;
  category: string;
  level: string;
  years: string;
  featured: boolean;
}

/** Generic profile record (employment, education, accomplishments, languages, …). */
export interface ProfileRecord {
  id: Id;
  public?: boolean;
  current?: boolean;
  neverExpires?: boolean;
  featured?: boolean;
  projects?: Id[];
  skillId?: Id;
  [field: string]: string | boolean | string[] | undefined;
}

export interface ResumeRecord {
  id: Id;
  name: string;
  size: number;
  format: string;
  uploadedAt: IsoDateTime;
}

export interface CareerPreferences {
  industry: string;
  department: string;
  category: string;
  currentType: string;
  roles: string;
  industries: string;
  departments: string;
  types: string;
  locations: string;
  arrangement: string;
  notice: string;
  salary: string;
  currency: string;
  interests: string;
}

export interface PersonalDetails {
  gender: string;
  dob: string;
  marital: string;
  nationality: string;
  permit: string;
  address: string;
  city: string;
  region: string;
  country: string;
  postal: string;
  contact: string;
}

export interface ProfessionalDetails {
  revision?: number;
  version: 1;
  updatedAt: IsoDateTime | "";
  phone: string;
  currentTitle: string;
  currentCompany: string;
  employmentStatus: string;
  focus: string;
  strengths: string;
  resume: ResumeRecord | null;
  skills: ProfileSkill[];
  employment: ProfileRecord[];
  education: ProfileRecord[];
  technicalSkills: ProfileRecord[];
  onlineProfiles: ProfileRecord[];
  workSamples: ProfileRecord[];
  publications: ProfileRecord[];
  presentations: ProfileRecord[];
  patents: ProfileRecord[];
  certifications: ProfileRecord[];
  career: CareerPreferences;
  personal: PersonalDetails;
  languages: ProfileRecord[];
  diversity: { accessibility: string; military: string; context: string };
  careerBreaks: ProfileRecord[];
  privacy: { email: boolean; phone: boolean };
  photoRemoved: boolean;
}

export type ProfileCollection =
  | "skills"
  | "employment"
  | "education"
  | "technicalSkills"
  | "onlineProfiles"
  | "workSamples"
  | "publications"
  | "presentations"
  | "patents"
  | "certifications"
  | "languages"
  | "careerBreaks";

// ---------------------------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------------------------

export interface PostDraft {
  version?: number;
  editorToken?: string;
  id: Id;
  title: string;
  body: string;
  project: Id | "";
  media: MediaItem[];
  videoUrl: string;
  step: number;
  reached: number;
}

export interface JobWizardValues {
  companyName: string;
  hideCompany: boolean;
  title: string;
  department: string;
  role: string;
  employment: string;
  experienceMin: number | string;
  experienceMax: number | string;
  currency: "INR" | "USD" | "EUR" | "GBP";
  salaryMin: string;
  salaryMax: string;
  variableEnabled: boolean;
  variablePercent: string;
  hideSalary: boolean;
  arrangement: string;
  locations: string[];
  relocate: boolean;
  vacancies: number | string;
  skills: string[];
  essentialSkills: string[];
  education: string[];
  industries: string[];
  description: string;
  responsibilities: string;
  requirements: string;
  benefits: string;
  questions: ScreeningQuestion[];
  expiresAt: string;
  reference: string;
  contactEmail: string;
  requirePortfolio: boolean;
  notifyResponses: boolean;
  applicationInstructions: string;
  thumbnail: JobThumbnail;
  jobMedia: JobMedia;
  aiVerified?: boolean;
}

export interface JobDraft {
  /** Local editor lineage; never sent to the API. */
  editorToken?: string;
  version?: number;
  jobVersion?: number;
  id: Id;
  existingId: Id | "";
  step: number;
  reached: number;
  values: JobWizardValues;
  savedAt: IsoDateTime | "";
  generated?: { mode: "template-demo"; role: string; at: IsoDateTime } | false;
  aiPrevious?: { values: Partial<JobWizardValues>; step: number; reached: number; generated: JobDraft["generated"] };
}

// ---------------------------------------------------------------------------------------------
// Whole demo database (the mock backend's persisted state)
// ---------------------------------------------------------------------------------------------

export interface DemoSettings {
  notifications: boolean;
  updatesPublic: boolean;
}

export interface DemoSession {
  role: Role;
}

export interface DemoDatabase {
  schema: 1;
  social: SocialData;
  recruiterSocial: SocialGraph;
  professionals: Professional[];
  projects: Project[];
  updates: WorkUpdate[];
  companies: Company[];
  conversations: Conversation[];
  shortlists: Shortlist[];
  portfolios: Record<Id, PortfolioConfig>;
  settings: DemoSettings;
  session: DemoSession | null;
  recruiter: RecruiterData;
  organizationWorkspace: OrganizationWorkspace;
  employerRegistrations: EmployerRegistrationRecord[];
  postEditorDrafts: Partial<Record<Role, PostDraft>>;
  jobEditorDrafts: Record<string, JobDraft>;
}
