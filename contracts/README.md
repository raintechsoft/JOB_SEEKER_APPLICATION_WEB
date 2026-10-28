# Frontend contracts

These are the original shared contracts from the former monorepo's `contracts/` directory, restored on 2026-10-27. `validation/career-journey.json` was authored later for Career journey; it is mirrored by the backend's `resources/contracts/career-journey.json` and checked by `npm run test:journey`.

Runtime imports resolve inside this repository, never the original monorepo's `../../contracts` directory.

The backend keeps identical copies in its own `contracts/` directory (read through `App\Support\Contracts`). After changing a file here, copy it there and run `python scripts/check_contracts.py` from the ML repository to confirm the copies agree. Contract-generation scripts under `scripts/` still refer to the original monorepo layout.
