# vchat-web

React SPA that renders honeybee chat archives. See
`docs/superpowers/specs/2026-05-23-vchat-web-spa-design.md`.

## Local development

Requires Node 24 (see `.nvmrc`). Copy `.env.example` to `.env.local`
and set `VITE_DATA_PROXY` to any deployment that serves the
honeybee-written `/data` tree. Then:

```
npm install
npm run dev
```

## Scripts

- `npm run dev` — Vite dev server on http://localhost:5173
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
