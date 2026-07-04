# Deploying the internal MVP at `https://<site>/dce`

The presentation site (`site-presentation/`) and the internal MVP (`frontend/` + `backend/`) are
**separate apps** served on **one domain** using [Next.js Multi-Zones](https://nextjs.org/docs/app/guides/multi-zones):

```
https://<site>/          → site-presentation      (default zone, existing Railway service)
https://<site>/dce/*     → [rewrite] MVP frontend  (new Railway service, basePath "/dce")
MVP console  ──fetch(NEXT_PUBLIC_API_URL)+CORS──►  backend FastAPI (new Railway service)
```

`frontend/` has `basePath: "/dce"`; `site-presentation/next.config.ts` rewrites `/dce` + `/dce/:path*`
to `MVP_ORIGIN`. Login (`GET /auth/me`) is env-based HTTP Basic and needs no DB/Redis, so the
`login → console` flow works with just these two services. `/ready` will show **degraded** until
Postgres/Redis are added later (M1+).

> ⚠️ **Security:** `/dce` is public. Set a strong `BASIC_AUTH_USERS` on the backend service —
> never ship the `baptiste:changeme` placeholder.

## Provisioning (Railway dashboard, same GitHub repo)

Do these in order — services reference each other's URLs.

### 1. Backend service
- **New service → Deploy from GitHub repo** `BaptisteFaisy/PME-offrepublique`.
- **Settings → Root Directory = `backend`** (Railway builds `backend/Dockerfile`; `backend/railway.json`
  pins the Dockerfile builder + `/health` healthcheck).
- **Variables:**
  | Key | Value |
  |---|---|
  | `APP_ENV` | `prod` |
  | `BASIC_AUTH_USERS` | `user1:STRONG_PASS_1,user2:STRONG_PASS_2` |
  | `CORS_ALLOW_ORIGINS` | *(fill in step 4)* |
- **Settings → Networking → Generate Domain** → note it as `<backend-url>` (e.g. `https://mvp-api-production.up.railway.app`).

### 2. MVP frontend service
- **New service → same repo.**
- **Root Directory = `frontend`** (Nixpacks; `frontend/railway.json` sets start `next start -p $PORT`
  + `/dce` healthcheck).
- **Variables:** `NEXT_PUBLIC_API_URL = https://<backend-url>` — **build-time** (inlined into the
  client bundle), so it must be set before the first build.
- Deploy → **Generate Domain** → note `<mvp-url>`. Sanity check: `https://<mvp-url>/dce` should show
  the login page directly (root `/` returns 404 by design — that's the basePath).

### 3. Presentation site service (existing)
- **Variables:** add `MVP_ORIGIN = https://<mvp-url>` — **build-time** (baked into the routes
  manifest). **Redeploy** so the rewrite takes effect.

### 4. Close the CORS loop
- Set the backend's `CORS_ALLOW_ORIGINS = https://<site-domain>` (the public site domain that serves
  `/dce`). **Redeploy** the backend.

### 5. Verify
- `https://<site>/dce` → login → console.
- Log in with a `BASIC_AUTH_USERS` pair → console loads (`/ready` shows *degraded* — expected).
- `https://<site>/` (marketing site) still works and is unchanged.

## Later: full stack for M1–M4
Add these and set the matching backend + worker vars, then remove the *degraded* state:
- **Postgres + pgvector** → `DATABASE_URL` (needs a pgvector-capable image/template).
- **Redis** → `REDIS_URL` (+ a **worker** service: same `backend` root, start `python -m app.workers.worker`).
- **S3-compatible storage** (Railway has no native S3 — use Scaleway/OVH or a MinIO service) →
  `S3_ENDPOINT_URL`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_DCE`.
- **Anthropic** → `ANTHROPIC_API_KEY` for the Fiche AO extraction.

## Local multi-zone smoke test (before pushing)
```bash
# 1. backend
docker compose up

# 2. MVP zone on :3001
cd frontend && npm run dev -- -p 3001        # http://localhost:3001/dce

# 3. site zone on :3000, pointed at the MVP zone
cd site-presentation && MVP_ORIGIN=http://localhost:3001 npm run dev
# open http://localhost:3000/dce  → proxies to the MVP login → console
```
