# Frontend contracts

`validation/career-journey.json` is a newly authored contract for Career journey, mirrored by the backend's `resources/contracts/career-journey.json` and checked by `npm run test:journey`. The reconstruction caveat below applies to the pre-existing feature contracts.

This standalone checkout includes its validation data here. Runtime imports must resolve inside this repository, rather than the original monorepo's `../../contracts` directory.

The upstream shared JSON files were absent from both supplied repositories. These definitions were reconstructed from the current form options, validation messages, domain types, and generated API types. They are not recovered upstream contracts: numeric limits, search configuration, and hiring transitions still need comparison with the original shared contracts before deploying against a production API. The backend remains authoritative for writes.

The analytics browser event names and property allowlist match `src/types/generated/api.ts`; analytics remains disabled by the existing environment setting. Profile form fields and choices match `src/features/profile/profile-forms.tsx`.

When the original contracts are available, replace these JSON files with that version and keep these repository-local import paths. Backend contract paths and contract-generation scripts still refer to the original monorepo and require a separate shared-contract setup.
