# Frontend architecture

The Skillora prototype (`Skillora-Standalone.html`, kept unmodified at the repository root) migrated
to a Next.js App Router application. This document covers the final structure, data flow, the
integration boundaries for the future backend, and known limitations.

## Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 16.4 (App Router, Turbopack), React 19.3 | `npm run dev`, `build`, `start` |
| Language | TypeScript 5.9, `strict` | `npm run typecheck` |
| Styling | Prototype CSS (22 files, original cascade) + Tailwind CSS 4 (theme and utilities only, **no Preflight**) | See `design-system.md` |
| Server state | TanStack Query 5 over a typed service layer | `src/hooks/use-services.ts` |
| Client state | Zustand 5 (session UI state, modal, toasts, editor drafts) | `src/stores`, `src/features/organization/draft-store.ts` |
| Forms | React Hook Form 7 + Zod 4 with native constraint reporting | `src/lib/validation` |
| Tests | Vitest 5 + Testing Library (unit and component), Playwright 1.64 (e2e and visual comparison, using the installed Microsoft Edge) | `npm test`, `npm run test:e2e` |
| Package manager | npm (no other lockfile exists) | |

Not adopted, with reasons:

* **shadcn/ui**: its primitives carry their own visual language. The prototype's native `<dialog>`,
  `<details>` and form controls already give accessible behavior and match the design exactly.
* **Lucide**: the prototype's icons are custom path data and have been ported unchanged.
* **Next.js Middleware/Proxy**: no server-side concern exists yet, and auth is simulated (see below).

## Repository layout

The repository held only the HTML prototype, so the app lives at the root (no `apps/` or `packages/`
monorepo). Shared contract types live in `src/types` and can be extracted to a package once a
backend repository needs them.

```text
Skillora-Standalone.html     original prototype (reference, untouched)
docs/                        audit, inventories, design system, this document
public/fonts, public/images  assets extracted from the prototype
scripts/                     extract-prototype-css, compare-screens, diff-screens
src/
  app/                       routes only (Server Components that render client screens)
    (site)/                  public site: /, /how-it-works, /talent, /professionals/[slug], /portfolio/[slug], /onboarding
    (auth)/                  /login, /signup, /employer/login, /employer/register
    (professional)/          ProfessionalShell: /app/*, /organizations/[slug], /recruiters/[id]
    (recruiter)/             RecruiterShell: /recruiter/*
    (admin)/                 AdminShell: /admin/[page]
    api/health/              liveness endpoint (not a business API)
    layout.tsx, error.tsx, loading.tsx, not-found.tsx, globals.css, icon.svg
  components/                presentational building blocks
    ui/                      Icon, Button, Avatar, floating-label fields, ModalHost, Toaster, QueryView…
    layout/                  shells, public chrome, auth chrome, body-class sync, shortcuts
    feed/ jobs/ work/ talent/ portfolio/ organization/
  features/                  screens and feature logic (hooks, dialogs) per domain
    activity admin applications auth feed job-wizard messaging organization
    portfolio posts profile recruiting settings site talent work workspace
  services/                  service interfaces (*.service.ts) and mock implementations (*.mock.ts)
    api/                     HTTP client + data-source config for the future backend
  mocks/                     MOCK BACKEND: seed fixtures (data/), browser storage (store/)
  lib/                       domain rules (domain/), validation, analytics, routing, utils
  hooks/ providers/ stores/ styles/ types/
tests/unit, tests/e2e
```

## Rendering model

* **Route files are Server Components.** They export metadata, read `params` and `searchParams`,
  and render a feature screen. Static marketing content (home, how-it-works) is fully
  server-rendered, with small client islands for browser-local data.
* **Screens are Client Components** because all data currently lives in the browser
  (`localStorage`, as in the prototype). When the HTTP backend arrives, screens keep the same
  hooks; data could then also be prefetched on the server.
* **Hydration safety**: `useServiceQuery` reports "pending" until hydration has completed
  (`useHydrated`), so server HTML and the first client render always agree, even for late-hydrating
  Suspense boundaries. Screens that read `useSearchParams` are wrapped in `<Suspense>` at the route.
* **Body classes**: about 1,700 prototype rules are scoped to `body.professional-theme` (plus
  `messaging-page` and `job-wizard-page`). An inline script sets them before first paint, and
  `BodyClassSync` keeps them in step on client navigation.
* **Layouts** replace the prototype's partial-render trick: the sticky header, nav and account
  menu persist across navigation inside a workspace.

## Data flow

```text
Screen / component
  → useServiceQuery(key, s => s.feed.getFeed(query))      reads (TanStack Query)
  → useServiceAction()(s => s.feed.toggleLike(role, id))  writes, then invalidates queries
      → Services (src/services/index.ts, chosen by NEXT_PUBLIC_DATA_SOURCE)
          → mock implementation (*.mock.ts) → src/mocks/store/demo-db.ts (immer + localStorage)
          → [future] HTTP implementation → src/services/api/client.ts → NestJS API
```

* Every read and write goes through a typed service interface. No screen imports mock data.
* Mock services are `async`, so the HTTP version can replace them without UI changes. There are
  no artificial delays.
* `commit(recipe, { rollbackOnFailure })` reproduces the prototype's storage-full handling: the
  "kept for this page only" behavior versus a refused change.
* Pure business rules shared by the UI (live feedback) and the mock backend live in
  `src/lib/domain` (job alerts, salary formatting, organization validation and completion, profile
  completion, template job generator). The backend should own the authoritative versions.

### State boundaries

| Kind | Where | Examples |
| --- | --- | --- |
| URL | search params | applications tab/q/status, projects filters, jobs manager filters and pagination, the full response-centre query, organization section, activity tab and limit, `?post=` permalinks |
| Local component | `useState` | open menus, editor drafts while typing, carousel index, emoji picker |
| Shared session UI | `useUiStore` | feed filter/sort/query/visible, jobs-rail tab, talent filters, compared candidates, selected conversation, response and job selections |
| Editor drafts | `useOrganizationDrafts`, message drafts store | unsaved organization/recruiter edits shared by editor and preview pages |
| Server state | TanStack Query | everything returned by services |
| Auth | `services.workspace` (mock) | demo session role |

## Authentication and authorization (simulated)

As in the prototype, a role is set by visiting `/app/*` or `/recruiter/*`, by the demo buttons, or by
sign-in and sign-up (no credential checks). `services.workspace` isolates this; **it is not
security**. Organization roles (Admin, Recruiter, Hiring Manager) only gate UI actions. The real
backend must issue sessions and enforce authorization; route protection can then be added with a
Next.js proxy plus server-side checks.

## Backend integration

1. Implement `createHttp<Domain>Service(http)` for each interface in `src/services/<domain>/*.service.ts`,
   using `createHttpClient(apiConfig.baseUrl, getToken)`.
2. Register them in `createServices()` when `NEXT_PUBLIC_DATA_SOURCE=http` (it currently throws on
   purpose rather than silently using fake data).
3. Replace the blanket post-write invalidation with targeted query keys where useful.
4. Move authoritative rules (search, filtering, matching, ranking, validation) to the API. Keep
   the client copies only for instant feedback.

Contract notes:

* **Feed** (`FeedService.getFeed` returns `FeedPage`): items carry post/job/update display data, author or
  company summaries, linked project, interaction counts, the viewer's state (`liked`, `saved`,
  `following`, `own`), timestamps and pagination metadata. Ranking signals are deliberately not
  part of the contract.
* **Search**: `SearchRequest<TFilters>` and `Paginated<T>` in `src/types/api.ts` are the common
  shape. Jobs manager, response centre, talent, feed and applications already map onto them.
* **Recommendations** (`RecommendationsService.getJobsForYou`): returns jobs plus a human-readable
  reason. The mock reproduces the prototype's transparent rules (alert keyword matches, then
  profile and skill overlap). K-Means, pgvector and XGBoost belong to the backend and are not
  emulated or labelled as AI.
* **Organization, registration, messaging, profile, portfolio, recruiting** each have a dedicated
  interface. The demo OTP returns `demoCode` only in the mock.

## Analytics

`src/lib/analytics` exposes a typed `track(event, props)` with a pluggable adapter: the console in
development, a no-op in production until `setAnalyticsAdapter(mixpanelAdapter)` is wired. The
events used are `feed_item_impression` (visibility-based, at least 50% visible, once per mount
via `useImpression`), `feed_item_clicked`, `job_viewed`, `job_saved`, `job_application_started`,
`job_application_completed`, `company_followed`, `person_followed`, `post_liked`, `post_saved`,
`post_commented`, `post_published`, `search_performed` and `job_alert_saved`. Properties carry
ids and coarse context only: no names, emails, message text or notes.

## Verification performed

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass (0 problems) |
| `npm test` (Vitest) | 28 tests pass: domain rules, mock services (feed, jobs, recruiting, registration, talent, portfolio), floating fields and primitives |
| `npm run test:e2e` (Playwright, production build) | 31 tests pass: navigation (deep links, back/forward, refresh, 404, body classes), feed interactions, search, apply and track, job alerts, post editor, work update validation, job wizard with template generator, response centre, talent and shortlists, organization validation and save, messaging, the 5-step employer registration with demo OTP, and no horizontal overflow at 375 px on 9 pages |
| Visual comparison (`npm run compare`, `node scripts/diff-screens.mjs`) | 33 routes at 1440 px, 11 at 768 px and 11 at 390 px, plus open dialogs. All routes are at most 0.3% different pixels; most are identical. Remaining differences: `next/image` resampling of the auth illustrations, the prototype's lazily decoded home illustrations, and a 4 px chat scroll offset. |
| Console errors | none on the compared routes |
| Production build | 43 static and 9 dynamic routes |

## Known limitations

* **Browser-local data.** Like the prototype, everything is stored in `localStorage` (and resumes in
  IndexedDB) on this device. Shared links to user-created content work only in the same browser.
* **Unsaved-changes guard** for profile dialogs covers closing the dialog (Esc, backdrop, Cancel).
  It does not intercept in-app navigation, which the prototype's own router could.
* **Simulations kept as in the prototype**, and labelled in the UI: login, Google sign-in, OTP, CV
  parsing, QR code, link expiry/OTP protection, notifications, verification, invitations,
  outreach, the "AI" filter and "Create with AI".
* **Dead prototype code not migrated**: `company3()`, `heroPreview()`, and the unreferenced
  `post-media-up/down`, `job-duplicate` and `feed-insights` actions.
* **`npm audit`** reports 5 high-severity advisories in dev-only lint tooling
  (`eslint-config-next` → `@next/eslint-plugin-next` dependency chain). There are no runtime
  dependencies affected. Revisit when upstream releases a fix.
* `AGENTS.md` at the root is generated by `next dev` (Next.js 16.4) and is re-created if deleted.

## Recommended next steps

1. Agree the API contract with the NestJS team using the service interfaces and `src/types`.
   Then implement the HTTP services domain by domain, starting with auth, feed and jobs.
2. Replace the mock session with real authentication (httpOnly cookies), add route protection,
   and enforce organization roles server-side.
3. Wire the Mixpanel adapter behind consent, and verify event names with product analytics.
4. Move uploads (avatars, covers, attachments, resumes) to signed object-storage uploads. Drop the
   data-URL storage.
5. Add `@axe-core/playwright` accessibility assertions to the e2e suite and CI (typecheck,
   lint, unit and e2e).
