# Component inventory

Each prototype template function is mapped to its React component. "Shared" means it is used by
more than one feature.

## UI primitives — `src/components/ui`

| Prototype | Component | Notes |
| --- | --- | --- |
| `icon(name)` + `paths` | `Icon` | Same path data; unknown names fall back to `spark`. |
| `feedActionIcon` | `FeedActionIcon` | like / comment / share / save (32px). |
| `brand()` | `Brand` | Link to `/`. |
| `avatar(p, size)` | `Avatar` | Portrait or initials; recruiters use `picture`. |
| `btn`, `linkBtn`, `iconBtn` | `Button`, `LinkButton`, `IconButton` | Same classes (`btn primary sm text danger`, `iconbtn`). |
| `tags`, `badge` | `Tags`, `Badge` | |
| `field`, `textarea`, `select` | `TextField`, `TextAreaField`, `SelectField` | Floating-label DOM (see design system). |
| check rows | `CheckRow` | `label.check-row`. |
| `empty()` | `EmptyState` | |
| `heading()` | `PageHeading` | |
| `#modal` + `openModal()` | `ModalHost` + `useModal()` | Native `<dialog>` with `showModal()`; variants `sheet`, `project`, `following`; focus restoration; backdrop click to close; dirty-form guard hook. |
| `confirm()` | `ConfirmDialog` | |
| `toast()` | `Toaster` + `useToast()` | 4 s, `aria-live="polite"`. |
| settings switch | `Switch` | `label.switch`. |
| — | `Skeleton`, `ScreenFallback` | Loading states while the browser-local data store hydrates. |

## Layout — `src/components/layout`

| Prototype | Component |
| --- | --- |
| `professionalShell` | `ProfessionalShell` (header, search, nav with unread badge, notifications, account menu) |
| `recruiterShell` | `RecruiterShell` |
| `shell(…, admin)` | `WorkspaceShell` (admin sidebar layout) |
| `publicNav`, `footer` | `PublicNav`, `PublicFooter` |
| `authHeader`, `authStory`, `googleSignInButton` | `AuthHeader`, `AuthStory`, `GoogleSignInButton` |
| navigation dock | `useNavigationDock` hook |
| body classes | `BodyClassSync` + inline pre-paint script |

## Shared domain components — `src/components/shared`, `src/components/<domain>`

| Prototype | Component | Used by |
| --- | --- | --- |
| `art(project)` | `ProjectArt` | projects, feed, home, talent, profile |
| `projectCard` | `ProjectCard` | home, projects, portfolio, profile pages |
| `heatmap`, `pulseCard`, `miniPulse` | `Heatmap`, `PulseCard`, `MiniPulse` | feed, work pulse, how-it-works, profiles, talent |
| `updateItem` | `UpdateItem` | work pulse, profiles, portfolio |
| `talentCard` | `TalentCard` | discover, talent, overview, shortlists |
| `portfolio()` | `PortfolioSite` | builder, preview, public portfolio |
| `publicCredentials` | `PublicCredentials` | profile, portfolio |
| `stat()` | `StatCard` | overview, admin |
| `feedCard` | `FeedCard` (+ `FeedArtwork`, `FeedComments`, `JobVisual`) | both feeds, activity, post preview |
| `postCarousel` | `PostCarousel` | feed, post editor preview |
| `jobArtwork`, `jobMediaExtras` | `JobArtwork`, `JobMediaExtras` | feed, wizard, jobs manager |
| `companyAvatar` | `CompanyAvatar` | feed, network sheet, job modal |
| `verificationBadge` | `VerificationBadge` | organization pages |
| org form controls (`orgField`, `orgArea`, `orgSelect`, `orgCheck`, `orgChoices`, `orgChips`, `orgImageUpload`) | `components/organization/controls.tsx` | organization and recruiter editors |

## Feature screens — `src/features/<domain>/screens`

| Domain | Screens / feature components |
| --- | --- |
| `site` | `HomeScreen`, `HowItWorksScreen`, `OnboardingScreen` |
| `auth` | `AuthScreen`, `EmployerRegistrationScreen` |
| `feed` | `ProfessionalFeedScreen`, `RecruiterFeedScreen`, `ProfileColumn`, `JobsPanel`, `RecruiterProfileRail`, `HiringRail`, `Composer`, `NetworkPrompt`, `NetworkSheet`, `JobDetailsDialog`, `ApplyJobDialog`, `JobAlertEditor`, `JobAlertManager` |
| `posts` | `PostEditorScreen` |
| `activity` | `ProfessionalActivityScreen`, `RecruiterActivityScreen` |
| `applications` | `ApplicationsScreen` (applied/saved/alerts) and its dialogs |
| `projects` | `ProjectsScreen`, `ProjectForm`, `ProjectDialog`, `UpdateForm`, `WorkPulseScreen` |
| `portfolio` | `PortfolioBuilderScreen`, `PortfolioPreviewScreen`, `PublicPortfolioScreen`, `SharePortfolioDialog` |
| `profile` | `ProfileScreen` (13 sections), record/section editors, photo, completion |
| `messaging` | `MessagingScreen` |
| `settings` | `SettingsScreen` |
| `talent` | `DiscoverScreen`, `CandidateScreen`, `ShortlistsScreen`, `CompareScreen`, `OverviewScreen` and shortlist dialogs |
| `recruiting` | `JobsManagerScreen`, `ResponseCenterScreen`, `RecruiterReviewDialog` |
| `job-wizard` | `JobWizardScreen`, `JobAiDialog`, stage components |
| `organization` | `OrganizationEditorScreen`, `RecruiterIdentityScreen`, `OrganizationPublicScreen`, `RecruiterPublicScreen`, team and verification sections |
| `admin` | `AdminScreen` |
