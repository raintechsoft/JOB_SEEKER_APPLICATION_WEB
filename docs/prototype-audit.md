# Prototype audit — `Skillora-Standalone.html`

This audit describes the prototype **as it exists**. The original file is kept unmodified at the
repository root as the reference for visual and functional comparison.

## 1. What the file contains

| Part | Size | Notes |
| --- | --- | --- |
| Whole file | 9.4 MB, 8,587 lines | Single self-contained HTML document. |
| Embedded assets | 16 base64 `data:` URIs | 9 TTF fonts, 3 SVG avatar portraits, 4 PNG illustrations (2 unique). |
| CSS | ~405 KB, lines 2–3297 | 22 concatenated source files (`/styles.css`, `/feed.css`, … `/public-home.css`). |
| Markup | 1 line | `<a class="skip">`, `<div id="root">`, `<dialog id="modal">`, `<div id="toasts">`. Everything else is rendered by JS. |
| JavaScript | ~530 KB, lines 3298–8583 | An esbuild bundle of 36 `dist/*.js` modules wrapped in an IIFE. |

There are no other files in the workspace: no `package.json`, no image folder, no git history.
Nothing is loaded from the network (fonts and images are inlined).

### Embedded assets (extracted to `public/`)

| Original | Destination | Used by |
| --- | --- | --- |
| DM Sans 400/500/600/700 (TTF) | `public/fonts/dm-sans-*.ttf` | Body text (`:root` font-family). |
| Manrope 400/500/600/700/800 (TTF) | `public/fonts/manrope-*.ttf` | Headings, brand, buttons (via CSS). |
| `p0` portrait SVG | `public/images/avatars/alex-morgan.svg` | Alex Morgan (the signed-in demo professional). |
| `p1` portrait SVG | `public/images/avatars/priya-sharma.svg` | Priya Sharma. |
| `p3` portrait SVG | `public/images/avatars/maya-chen.svg` | Maya Chen. |
| Employer PNG (1199×1312) | `public/images/illustrations/employer-hiring.png` | Employer auth story + home "For employers" pathway. |
| Job-seeker PNG (1227×1282) | `public/images/illustrations/job-seeker-journey.png` | Professional auth story + home "For job seekers" pathway. |

The two pathway PNGs on the home page are byte-identical copies of the auth illustrations
(MD5 verified), so each is stored once.

## 2. Runtime architecture of the prototype

* **Routing** — hash routing (`#/app/dashboard`) behind a fake `location`/`history` shim
  (`__standaloneLocation`, `__standaloneHistory`). A `routes` map plus prefix matching renders an
  HTML string into `#root`. Internal `<a href>` clicks are intercepted; `popstate` re-renders.
* **Partial updates** — `updateView()` swaps only `.professional-main` when the shell type does not
  change, so the sticky header and account menu survive navigation.
* **State** — one mutable object `db` persisted as JSON in `localStorage["skillora-demo-v1"]`, seeded
  by `seed()` with dates relative to "now". Several module-level objects hold UI state
  (`feedState`, `panelState`, `state` in pages.js, wizard/editor drafts, selections).
  Resume files are stored as Blobs in IndexedDB (`skillora-profile-files`).
* **Events** — global delegated listeners: `[data-action="name:arg1:arg2"]` click dispatch,
  `submit` handlers chained per module, `change`/`input` handlers keyed by element ids.
* **Body classes** — `professional-theme` (for `/app`, `/recruiter`, `/organizations`, `/recruiters`
  and the auth pages), `messaging-page`, `job-wizard-page`. About 1,700 CSS rules depend on them,
  including rules for the shared `<dialog id="modal">`.
* **Floating labels** — `floating-fields.js` rewrites every `<label class="field">Text<input></label>`
  into an outlined floating-label structure using a `MutationObserver`.
* **Navigation dock** — spring-animated magnification of header nav icons on fine pointers
  (disabled for reduced motion).

## 3. User roles and experiences

| Role | How it is entered | Experience |
| --- | --- | --- |
| Visitor | `/` | Marketing home, how it works, public talent directory, public profiles and portfolios. |
| Job seeker ("professional") | `/login?role=professional`, demo button, or any `/app/*` URL | Alex Morgan (`p0`). Feed, applications, activity, projects, portfolio, profile, messages, settings. |
| Recruiter / employer | `/employer/login`, `/employer/register`, demo button, or any `/recruiter/*` URL | Emma Wilson at Northstar Labs (`r0`, `c0`). Feed, jobs & responses, activity, messages, organization, recruiter identity, talent discovery, shortlists, compare. |
| Organization roles | Team & Recruiters section | *Organization Admin*, *Recruiter*, *Hiring Manager*. Front-end permission demo only. |
| Admin | `/admin/dashboard` (linked from the login page) | Legacy sidebar workspace: overview, users, companies, moderation. |

Authentication is simulated. Visiting a `/recruiter` or `/app` path switches the stored
`session.role`, and logging out clears it. No route is protected.

## 4. Screens (summary; see `route-inventory.md`)

45 distinct screens, grouped as:

* **Public site**: home, how it works, talent directory, public professional profile, public
  portfolio, onboarding, not found.
* **Auth**: professional login and sign-up, employer login, 5-step employer registration with demo
  OTP.
* **Professional workspace**: feed (+ job rail, network sheet, job detail/apply modals), My
  Application (applied/saved/alerts), My Activity (posts/comments/videos/images/reactions), projects,
  portfolio builder and preview, work pulse, profile manager (13 sections), messaging, settings,
  create post.
* **Recruiter workspace**: feed (+ profile rail, hiring rail), Manage Jobs & Responses, job response
  centre (advanced filters, keyword "AI" filter, bulk actions, CSV export), 7-step job wizard (+
  template-based "Create with AI"), My Activity, messaging, organization profile editor (7 sections,
  team management, verification), recruiter identity editor, previews, hiring overview, discover
  talent, candidate profile, shortlists, compare.
* **Public organization and recruiter pages** (rendered in the professional shell).
* **Admin** (4 pages).

## 5. Interaction inventory: status of each feature

### Working (real local behavior persisted to `localStorage`)

* Feed: filter tabs (For you/Following/Jobs/Saved), sort (recent/most liked), header search,
  like/unlike, save/unsave, inline comments, follow/unfollow people and companies, "see more" text
  expansion, pagination ("See more posts"), share (copies a permalink; `?post=` highlights a post),
  network sheet with Following/Followers tabs (arrow-key tab switching).
* Job rail: For you / Alert tabs, job alerts CRUD (create, edit, pause/resume, delete, manage),
  "NEW" badges cleared on view, mobile collapse.
* Job detail modal, demo application form (screening questions, optional recruiting details),
  saved application view.
* My Application: tabs, search, status filter (auto-submits), tracking edit, details, remove.
* My Activity: per-tab lists, edit/delete own posts and comments, remove reaction, "Load more".
* Create post: 3-step editor, autosaved draft, up to 5 images (1 MB each / 2 MB total) plus
  direct video URLs, media descriptions, live preview with a working carousel (arrows, dots,
  keyboard, swipe), publish then highlight in feed.
* Projects: category nav, search, visibility filter, project create/edit/delete (with cover image
  upload, date validation), project detail modal.
* Work updates: create, edit, delete, heatmap day modal, range select.
* Portfolio builder: live config (title, headline, slug with uniqueness check, accent colour,
  public), section show/hide and reorder, featured projects, desktop/mobile preview, share dialog
  (copy link, decorative QR, simulated expiry/OTP), print.
* Profile manager: 13 sections, record CRUD with per-collection forms, reordering, featured skills,
  skill and technical-skill search/sort, resume upload to IndexedDB (download/remove), photo upload,
  completion checklist, quick-link scroll spy, unsaved-changes guard on dialogs, copy link.
* Messaging (both roles): search, filters (all/jobs/unread/starred/archived), select thread,
  compose with image/file attachments (data URLs), emoji picker, Ctrl/Cmd+Enter to send, star,
  label, mark unread, mute, archive, report/block, delete, new conversation, mobile list/detail.
* Settings: visibility switches, reset demo data, log out.
* Recruiter feed: own posts and jobs with edit/delete/manage menu, hiring rail review modal.
* Jobs manager: tabs (All/Drafts), filters (status/category/location/date), sort, page size,
  pagination, selection and select all, bulk close and collaborate, per-job close/reopen, repost,
  preview, share and copy, edit, delete draft.
* Response centre: stage tabs with counts, applicant search and job filter, advanced filters
  (keywords any/all, location, distance with city-centre estimates, experience, salary, education,
  notice, joining, industry, designation, department), keyword match filter with auto-shortlist,
  sorting, page size, collapse/expand rows, single and bulk status, notes, contact modal, profile
  export (.txt), CSV export (formula-injection safe), remove from inbox, outreach draft, review
  tracking modal.
* Job wizard: 7 validated steps, chips with suggestions and "essential" stars, vacancies stepper,
  variable pay, screening questions (up to 6), posting options, thumbnail templates or upload,
  supporting media, review, save draft and exit, publish or publish changes, debounced autosave,
  template-based "Create with AI" with undo, line removal and a verification checkbox.
* Organization editor: section navigation, draft vs saved with live completion, field validation
  with error summary, image uploads (logo, cover, gallery), chips, check lists, verification
  workflow with sample outcomes, team table with search/filters, invite, simulate acceptance,
  resend, cancel, manage role/status (last-admin guard, deactivate confirmation), preview pages.
* Recruiter identity editor with photo upload; public recruiter page.
* Discover talent: live search, filters, active filter chips, sort, save to shortlists, compare
  (2–4), shortlists CRUD and rename, candidate profile, start conversation.
* Employer registration: 5 steps, per-country phone validation, demo OTP (6 inputs with paste,
  arrows, backspace, 60 s resend timer, 5-minute expiry, 5 attempts), password toggle, conditional
  company fields, account creation.
* Admin: toggle professional visibility, mark company demo-verified.

### Simulated or visual-only (clearly labelled as such in the UI)

* Login, sign-up and Google sign-in (Google shows "not connected yet").
* OTP delivery (the code is shown on screen).
* CV parsing in onboarding (loads sample data).
* QR code (decorative pattern, labelled "not scannable").
* Portfolio link expiry and OTP protection ("simulations").
* "AI filter" (local keyword matching) and "Create with AI" (role-based templates).
* Notifications (an empty state only).
* Organization verification (explicit sample outcomes).
* Invitations, outreach emails, candidate notifications (none are sent).
* `feed-insights` metrics (illustrative numbers; the action is defined but not linked from any view).

### Dead code in the bundle (not migrated)

* `company3()` — an older company form; `/recruiter/company` routes to the organization editor.
* `heroPreview()` — an unused hero component.
* Actions with no trigger in any rendered view: `sidebar` (admin uses it), `post-media-up/down`,
  `job-duplicate`, `job-collaborate` (single), `feed-insights`, `navigate-portfolio`,
  `recruiter-toggle-job`. These were ported where cheap (sidebar, insights) and noted otherwise.

## 6. Responsive behavior

Breakpoints come from the CSS: 1600 (wide), 1300, 1250, 1200, 1100, 1050, 1020, 1000, 850, 800,
720, 680, 550, 400, 360 px, plus height queries (740, 600, 450) for auth and dialogs. Key behaviors:

* Feed: 3 columns → 2 columns ≤1050 px (job rail moves above the timeline with a collapsible
  toggle) → 1 column ≤680 px (profile column collapses behind "Your profile insights" toggle).
* Header: nav wraps under the brand and search ≤850 px; labels shrink progressively.
* Messaging: list/detail switch on mobile (`show-direct-message`).
* Jobs manager / response centre: filter sidebars become toggled panels on small screens.
* Wizard steppers scroll horizontally on mobile with the active step centred.
* Print styles exist for feed, applications, profile and portfolio.
* `prefers-reduced-motion` disables transitions and the nav dock animation.

## 7. Risks and ambiguities

1. **Data URLs in `localStorage`** — uploaded images are stored inline; the ~5 MB quota is easy to hit.
   The prototype handles failed saves with rollbacks and messages; the migration keeps that.
2. **Relative seed dates** — seed data is generated relative to "now", so screenshots differ by day.
3. **Global mutable UI state** — feed filters, selections and drafts survive navigation in the
   prototype. Where that matters it is reproduced (feed filter state, drafts).
4. **CSS depends on exact DOM structure** (child combinators such as `.professional-nav>a>.icon`,
   floating-label siblings). Components reproduce the post-enhancement DOM exactly.
5. **Hash URLs** — prototype share links are `…html#/path`. The migration uses real paths, so
   shared links become `/app/dashboard?post=…`.
6. **No real security** — role switching is URL-driven by design. The migration isolates it behind a
   mock auth adapter and documents that it is not authorization.
