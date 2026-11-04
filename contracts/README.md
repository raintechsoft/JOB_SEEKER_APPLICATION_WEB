# Frontend contracts

App-local contracts for the Next.js app. Runtime imports resolve only under `apps/web/contracts` (and realtime under `src/services/realtime/contracts`). There is no monorepo-root `contracts/` directory.

Laravel keeps matching copies in `apps/api/contracts` (read through `App\Support\Contracts`). After changing a shared validation/OpenAPI/example file here, regenerate or mirror into `apps/api/contracts`. `npm run prebuild` runs `scripts/upload-validation-contracts.mjs --check` against `apps/api/contracts` as the Laravel source (override with `CONTRACTS_SOURCE`).

`validation/career-journey.json` is mirrored by the backend's `resources/contracts/career-journey.json` and checked by `npm run test:journey`.

`examples/` and `openapi/` hold fixtures and specs used by unit tests and `scripts/api-types.mjs`. `openapi/phase-11.json` is the merged cumulative contract: phase generators plus `openapi/phase-11-additions.json` via `scripts/advanced-contracts.mjs`, which also mirrors phase 11 into `apps/api/contracts/openapi`.
