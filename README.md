# Skillora web

Next.js frontend for Skillora, a professional networking, job-seeking and recruiting platform. It
is a faithful migration of the standalone prototype (`Skillora-Standalone.html`, kept unchanged
for comparison).

## Getting started

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_APP_ENV=development shows the demo logins
npm run dev          # http://localhost:3000
```

Try `/login`, then **Professional demo** or **Recruiter demo**. All people, companies and jobs are
fictional, and every change is stored in this browser. Use **Settings → Reset demo data** to start
over.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `npm run build` / `npm start` | Develop, build, serve the production build |
| `npm run typecheck` | TypeScript (strict) |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm test` | Vitest unit and component tests |
| `npm run test:e2e` | Playwright end-to-end tests against a production build (uses installed Microsoft Edge; `PW_CHANNEL=chrome` for Chrome) |
| `npm run compare -- <baseUrl> <route…> [--width=390]` | Screenshots the prototype and the app side by side in `screenshots/` |
| `node scripts/diff-screens.mjs [filter]` | Pixel-diffs those screenshot pairs |

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_ENV` | `production` | `development` shows development-only UI: demo logins, the admin demo (`/admin` is a 404 otherwise), on-screen OTP codes, reset and simulation controls, and demo/prototype notices. Anything else hides them and uses production copy. |
| `NEXT_PUBLIC_DATA_SOURCE` | `mock` | `mock` = browser-local demo backend; `http` is reserved for the future API |
| `NEXT_PUBLIC_API_BASE_URL` | — | Base URL of the future NestJS API |

## Documentation

* `docs/prototype-audit.md` covers what the prototype contains and how it works.
* `docs/route-inventory.md` lists every route, its purpose, query state and empty states.
* `docs/component-inventory.md` maps prototype templates to React components.
* `docs/design-system.md` covers tokens, typography, shape, icons and form fields.
* `docs/frontend-architecture.md` covers structure, data flow, backend integration, verification and limitations.

## Development-only UI

Wrap elements in `<DevOnly>` (`src/components/ui/dev-only.tsx`) and pick copy with
`devCopy(developmentText, productionText)` (`src/lib/env/app-env.ts`). `NEXT_PUBLIC_*` values are
inlined at build time, so rebuild after changing `NEXT_PUBLIC_APP_ENV`. The end-to-end tests use
the demo logins and OTP codes: build with `NEXT_PUBLIC_APP_ENV=development npm run build` first.
