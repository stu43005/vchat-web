# vchat-web

React SPA that renders honeybee chat archives. See
`docs/superpowers/specs/2026-05-23-vchat-web-spa-design.md`.

## Local development

Requires Node 24 (see `.nvmrc`). Copy `.env.example` to `.env.local`
and set `VITE_DATA_PROXY` to any deployment that serves the
honeybee-written `/data` tree. Then:

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — Vite dev server on <http://localhost:5173>
- `npm run generate-routes` — regenerate `src/routeTree.gen.ts`
- `npm run build` — generate routes + typecheck + production build
- `npm run preview` — serve the built `dist/` locally
- `npm run lint` — ESLint
- `npm run typecheck` — generate routes + `tsc --noEmit`

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml` which builds
and syncs to S3 via OIDC, then invalidates CloudFront. Required
secrets: `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `S3_BUCKET`,
`CF_DIST_ID`.

For first-time setup (S3 bucket, CloudFront distribution + function,
OIDC IAM role, GitHub Secrets) see
[docs/deployment.md](docs/deployment.md).

### S3 layout contract

The bucket is shared with honeybee (the upstream archiver). Three
categories of content coexist:

- **SPA-owned** — everything written by this repo's deploy:
  - `/index.html` — SPA entrypoint (replaces what used to be the
    legacy root index)
  - `/favicon.svg`, `/icons.svg`
  - `/assets/*` — fingerprinted JS/CSS bundles
- **honeybee data tree (current format)** — JSON consumed by the SPA
  at runtime, all under the `/data/` prefix:
  - `/data/index.json` — global index
  - `/data/channels/<channelId>.json` — per-channel data
  - `/data/videos/<videoId>.meta.json` — per-video metadata
  - `/data/videos/<videoId>.jsonl` — per-video chat rows (JSONL)
- **honeybee legacy HTML (frozen, pre-SPA)** — static archives that
  live at the bucket root under YouTube channel IDs (which always
  start with `UC`), not under `/data/`:
  - `/UC<…>/index.html` — per-channel legacy index
  - `/UC<…>/<YYYYMMDD>_<videoId>.html` — per-video legacy archive

Honeybee must never write outside `/data/` and the existing `/UC*`
legacy tree. Adding new SPA top-level prefixes is fine; adding new
honeybee prefixes requires updating `.github/workflows/deploy.yml` so
the SPA deploy keeps respecting the boundary.
