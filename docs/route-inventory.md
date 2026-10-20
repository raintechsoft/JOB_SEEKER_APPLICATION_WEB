# Route inventory

Routes are taken from the prototype's `routes` map and prefix matching in `dist/app.js`. URL
structure is preserved exactly; only the transport changes (hash → real path). "Theme" means the
`professional-theme` body class.

Legend: **S** = Server Component route file rendering a Client screen (data is browser-local in
this phase). Every data-driven screen has a loading skeleton (store hydration) and empty states.

## Public site — route group `(site)`, public nav + footer, no theme

| URL | Purpose | Role | Data | Key interactions | Empty / error states |
| --- | --- | --- | --- | --- | --- |
| `/` | Marketing home | Visitor | p0 profile, 3 projects | Links, mobile menu, employer menu, project modal | — |
| `/how-it-works` | Explainer | Visitor | p0 work pulse (182 days) | Heatmap day modal | — |
| `/talent` | Public talent directory | Visitor | Public professionals | Search, filters, chips, sort, save to shortlist | "A little room to broaden your search." |
| `/professionals/[slug]` | Public professional profile | Visitor | Professional, projects, updates, portfolio | Save to shortlist, start conversation, project modal | Private profile; not found |
| `/portfolio/[slug]` | Public portfolio | Visitor | Portfolio config | Contact | Private portfolio; not found |
| `/onboarding` | Post-sign-up onboarding | New user | p0 / c0 | 4 steps (professional) or 1 (recruiter), demo CV | — |

## Auth — route group `(auth)`, auth header, theme

| URL | Purpose | Notes |
| --- | --- | --- |
| `/login?role=professional\|recruiter` | Sign in | Demo login buttons, Google (not connected), admin link. |
| `/signup?role=…` | Create profile | `role=recruiter` renders employer registration. |
| `/employer/login` | Employer sign in | "Create account" link to registration. |
| `/employer/register` | 5-step employer registration | Demo OTP, creates the organization and recruiter identity. |

## Professional workspace — `/app/*`, professional shell, theme

| URL | Screen | Query state |
| --- | --- | --- |
| `/app/dashboard` | Feed + profile column + job rail | `view=jobs\|saved`, `post=<id>` (highlight) |
| `/app/applications` | My Application | `tab=applied\|saved\|alerts`, `q`, `status` |
| `/app/updates` | My Activity | `tab=posts\|comments\|videos\|images\|reactions`, `limit` |
| `/app/projects` | Projects | `category`, `q`, `visibility` |
| `/app/portfolio` | Portfolio builder | — |
| `/app/portfolio/preview` | Portfolio preview | — |
| `/app/work-pulse` | Work Pulse | range kept in local state |
| `/app/profile` | Profile manager | `#profile-<section>` |
| `/app/messages` | Messaging | selected conversation in client state |
| `/app/settings` | Settings | — |
| `/app/posts/new` | Create post | `mode=post\|media\|video\|project` |

## Recruiter workspace — `/recruiter/*`, recruiter shell, theme

| URL | Screen | Query state |
| --- | --- | --- |
| `/recruiter/dashboard` | Recruiter feed + rails | `view=saved`, `post` |
| `/recruiter/applications` | Manage Jobs & Responses, **or** the Response centre when `job`, `stage` or `view=responses` is present | Jobs: `tab=drafts`, `q`, `status[]`, `category[]`, `location`, `days`, `sort`, `size`, `page`. Responses: `job`, `stage`, `q`, `sort`, `size`, `page`, `rows`, filter keys, `fit`, `fitTerms`, `threshold` |
| `/recruiter/jobs` | Manage Jobs & Responses | as above |
| `/recruiter/jobs/new` | Job wizard | `id` (edit) |
| `/recruiter/activity` | My Activity | `tab`, `limit` |
| `/recruiter/messages` | Messaging | — |
| `/recruiter/overview` | Hiring overview | — |
| `/recruiter/discover` | Discover talent | filters in client state |
| `/recruiter/talent/[id]` | Candidate profile | — |
| `/recruiter/shortlists` | Shortlists | active list in client state |
| `/recruiter/compare` | Compare candidates | compared ids in client state |
| `/recruiter/company`, `/recruiter/organization` | Organization editor | `section=overview\|about\|culture\|hiring\|verification\|team\|contact` |
| `/recruiter/company/preview` | Organization public preview (draft) | `section` (return target) |
| `/recruiter/profile` | My recruiter identity | — |
| `/recruiter/team/[id]` | Team member identity | — |
| `/recruiter/profile/preview` | Recruiter public preview (draft) | `id` |
| `/recruiter/posts/new` | Create post | `mode` |

## Public organization / recruiter pages — professional shell, theme

| URL | Screen | Unavailable state |
| --- | --- | --- |
| `/organizations/[slug]` | Public organization profile | Hidden profile or changed slug |
| `/recruiters/[id]` | Public recruiter profile | Hidden or inactive |

## Admin — workspace sidebar shell, no theme

`/admin/dashboard`, `/admin/users`, `/admin/companies`, `/admin/moderation`.

## Next.js-owned endpoints

| URL | Purpose |
| --- | --- |
| `/api/health` | Liveness probe for the frontend deployment. Not a business API. |

## Not found

Any unknown path, unknown professional slug, unknown portfolio slug or unknown talent id renders
"This chapter hasn't been written." (`app/not-found.tsx`, or the in-screen equivalent for dynamic
lookups that resolve on the client).

## Modals, sheets and drawers (not routes)

These are in-page interactions, as in the prototype: project create/edit/view, work update
create/edit/view, heatmap day, job details, apply, saved application, job alerts editor/manager,
network sheet, notifications sheet, global search (⌘K), share portfolio, shortlist chooser and
editor, compare chooser, confirmations, profile record editors, profile photo, completion checklist,
application tracking/details, recruiter review, post edit, response note/contact/outreach/AI filter,
job preview/share/collaborate, wizard "Create with AI", organization completion/invite/manage
member, message report, new message, privacy info.
