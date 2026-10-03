# Interior visualisations: setup and operation

The implementation generates one photorealistic image for the whole selected apartment. It uses the OpenAI image edit endpoint with the full prepared apartment plan as its only reference. Room detection, coordinate comparison and room selection have been removed from the admin workflow. Defaults are **1024 × 1024, medium quality**; set `VISUALISATION_IMAGE_SIZE` and `VISUALISATION_IMAGE_QUALITY` in the server environment. The square default keeps initial generation costs low.

Settings, model, prompt, full-plan source and palette are snapshotted per batch. Retrying from history retains that batch's settings and style for consistency. To use new settings, start a fresh selection from the generation form. `OPENAI_API_KEY` is server-only. Account access to the configured model must be verified before live use. The new whole-apartment prompt has not yet had a real-provider quality pilot.

## Database setup

This repository previously used `prisma db push` and had no migrations. The first three migrations provide: a baseline matching the pre-feature schema, an additive visualisation migration (including a partial unique index preventing simultaneous active jobs for the same room), and a durable usage ledger. The fourth adds direct apartment publications. Accepted generation requests count toward daily limits even if their apartment or batch is deleted.

For a **new, empty database**:

```sh
npm install
npx prisma migrate deploy
npm run db:generate
```

For an **existing database created with db push**, first compare it with the baseline; do not apply the baseline's CREATE TABLE statements to existing tables. When its schema matches the baseline, mark only the baseline as already applied, then deploy the additive migrations:

```sh
npx prisma migrate resolve --applied 20260924000000_baseline
npx prisma migrate deploy
npm run db:generate
```

Resolve schema drift before baselining. Do not run a reset or blindly baseline an unrelated database. Back up production before migrations. Normal `db push` does not install the partial index; use migrations for this feature. The additive migration does not change or remove existing apartment/floor records.

## Running

Copy the relevant entries from `.env.example` into the deployment environment, including an actual OpenAI key. Use Node 24. Start both web and worker with access to the same database, source uploads and private storage:

```sh
npm run dev
# Separate terminal/process:
npm run visualisations:worker
```

Production web uses `npm run build` and `npm start`; the worker uses the same worker command with production dependencies installed. `tsx` is a production dependency for the worker. The worker loads `.env` if present; injected environment values take precedence. Restart web/worker after changing configuration. The UI warns when the worker heartbeat is missing. Jobs remain durable while workers are offline.

Images are stored outside `public/`. Production needs a shared persistent PRIVATE filesystem mounted at `VISUALISATION_STORAGE_DIR` in every web/worker instance; ephemeral serverless storage is insufficient. An object-store adapter is a future deployment option, not implemented in this first version. Source uploads under `public/uploads` must also be accessible by the worker. Do not expose the private directory via the web server.

## Using the feature

1. Open a building/floor or apartment editor and choose **Interior visualisations**.
2. Select floor and apartment. Upload a dedicated apartment plan in the apartment editor and save it, or use its mapped floor-plan region. External image URLs require re-upload to Vizor.
3. Prepare the apartment source. If needed, manually mark its rectangle in the floor plan. Confirm the crop includes the whole selected unit and no neighbouring unit.
4. Choose one of six styles using the realistic image previews.
5. Click **Generate apartment image**. One click creates one image request; no room-analysis request is made.
6. Review against the full source plan, download, retry or publish. Publishing an apartment image replaces other current publications for that apartment. Prior generated images remain in private history.

The six style previews are AI-generated example interiors, saved as optimized WebP assets in `public/images/visualisation-styles`. They illustrate materials and mood, not the user's apartment. Prompt provenance is recorded in `docs/visualisation-style-samples.md`.

Generation inputs record `scope: apartment` and the full prompt. New jobs and publications are directly apartment-scoped; they never create synthetic rooms. Legacy room records, analysis results and the first three applied migrations are retained solely to preserve historical data. The fourth migration adds apartment publications and carries forward the latest reviewed image (preferring a whole-apartment image). Old image URLs remain compatible through small route adapters. Obsolete queued analysis/room jobs are marked superseded without a paid call; persisted output can still be recovered. Room models/settings/JSON comparison have no active code path.

Run `npx prisma migrate deploy` and `npm run db:generate`, then restart web and worker when upgrading. The migration is additive and does not delete history, images or legacy publication records.

## Cost and recovery

Daily per-company allowances use UTC days and transactional reservations. One image allowance is reserved for each whole-apartment request. Known pre-submission failures/superseded jobs release allowance; potentially accepted requests remain counted. Concurrency is enforced through the database across worker processes. Image size, quality and model are configurable; there is no unsupported fixed-price estimate in the UI. Provider usage is retained in private job results.

The job table is a native durable Postgres queue using `FOR UPDATE SKIP LOCKED`, atomic claims, leases and fenced completion. This avoids adding pg-boss or upgrading Prisma 6. The worker polls every two seconds and reconciles expired claims. There are no automatic image API retries. If a response is lost after submission, the result is marked `PROVIDER_OUTCOME_UNKNOWN`; an explicit new generation can incur another charge. Persisted outputs can be finalized during lease recovery without another provider call. Completed images are not automatically resubmitted.

Set `VISUALISATIONS_ENABLED=false` to stop accepting/starting new provider work; existing history and published images remain available. In-flight calls may still complete. Set `VISUALISATIONS_PUBLIC_ENABLED=false` to hide/revoke public serving while leaving private history intact.

Current source fingerprints are checked on enqueue, worker submission, publication and every public gallery/asset read. Source changes immediately make prior results ineligible for publication/public serving even though stale history is retained. Source files must remain immutable: replacing bytes behind an unchanged URL is unsupported; upload a new filename. The app upload endpoint creates UUID filenames.

## Retention and cleanup

All referenced history is retained; there is no automatic deletion of published/private versions. Orphaned assets (including files left after company/floor/apartment deletion or failed transactions) can be removed after a 24-hour grace period:

```sh
npm run visualisations:cleanup          # dry run: count only
npm run visualisations:cleanup -- --apply
```

Schedule the latter periodically on the same private volume. Back up database and private assets together. Publication/unpublication actions have an audit table. Asset URLs recheck publication; unpublishing cannot retract a previously downloaded copy.

## Verification

```sh
npm run lint
npm run build
npm test -- --run
```

The PostgreSQL integration suite is opt-in and **requires a separate database whose name contains `vizor_visualisations_test`**. Apply migrations to it, then run:

```sh
DATABASE_URL=postgresql://USER@localhost:5432/vizor_visualisations_test VISUALISATION_INTEGRATION=1 VISUALISATION_STORAGE_DIR=.data/visualisations-test npm test -- --run
```

Browser tests also require that isolated database and an explicitly fake key. No live worker should run against the test DB. The test invokes the worker with an injected fake provider and never calls OpenAI:

```sh
npx playwright install chromium
DATABASE_URL=postgresql://USER@localhost:5432/vizor_visualisations_test OPENAI_API_KEY=e2e-test-only VISUALISATION_STORAGE_DIR=.data/visualisations-test npm run test:e2e
```

If Chrome is already installed, set `PLAYWRIGHT_CHANNEL=chrome` to use it instead of downloading Chromium.

Tests cover one full-plan reference, settings, duplicate requests, explicit retries, replacement/unpublication, role/tenant isolation, stale plans, legacy queue retirement and ambiguous worker recovery. Validate image quality with representative real plans before production enablement. Photorealism does not guarantee architectural accuracy; human review remains required.

## Image cost display

The admin generation history shows estimated USD cost per image with an expandable text/reference-image/output breakdown and a batch subtotal. Existing saved usage is supported. Rates are fixed in `cost.server.ts`, verified on 2026-09-24 against https://developers.openai.com/api/docs/guides/image-generation#cost-and-latency. Estimates cover supported GPT Image 2.5 model IDs and exclude discounts, taxes and room-analysis calls. Unknown models, missing/malformed usage or cached usage without a supported breakdown are shown as unavailable and excluded from subtotals, never treated as free requests. The OpenAI usage link provides provider billing; these estimates do not reconcile invoices. Cost display itself uses saved usage; no additional provider call is required.
