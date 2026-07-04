# Deploying the internal MVP at `https://<site>/dce`

The internal console lives **inside the presentation site** (`site-presentation/src/app/dce/`), served
on the same origin under `/dce`. So there are only **2 services** in the single Railway environment:

```
web (site-presentation)   https://<site>/       → marketing site
                          https://<site>/dce    → login → internal console
                                │  browser JS calls NEXT_PUBLIC_API_URL
api (backend, FastAPI)  ◄───────┘  (cross-origin → CORS)
```

Login (`GET /auth/me`) is env-based HTTP Basic and needs no DB/Redis, so `login → console` works with
just these two services. `/ready` will show **degraded** until Postgres/Redis are added later (M1+).

> ⚠️ **Security:** `/dce` is public. Set a strong `BASIC_AUTH_USERS` on the **api** service —
> never ship the `baptiste:changeme` placeholder.

## Provisioning (Railway dashboard, same GitHub repo)

You already have the **web** service (site-presentation). You add **one** new service (the api) and
**one** variable on the web service.

### 1. API service (backend, FastAPI) — new
- **New service → Deploy from GitHub repo** `BaptisteFaisy/PME-offrepublique`.
- **Settings → Root Directory = `backend`** (builds `backend/Dockerfile`; `backend/railway.json` pins
  the Dockerfile builder + `/health` healthcheck).
- **Variables:**
  | Key | Value |
  |---|---|
  | `APP_ENV` | `prod` |
  | `BASIC_AUTH_USERS` | `user1:STRONG_PASS_1,user2:STRONG_PASS_2` |
  | `CORS_ALLOW_ORIGINS` | `https://<site-domain>` (the web service's public domain) |
- **Settings → Networking → Generate Domain** → note it as `<api-url>`.

### 2. Web service (site-presentation) — existing
- **Variables:** add `NEXT_PUBLIC_API_URL = https://<api-url>`.
  This is inlined into the client bundle at **build** time, so **redeploy** after setting it.

### 3. Verify
- `https://<site>/dce` → login → (a `BASIC_AUTH_USERS` pair) → **console**.
- The console's backend panel shows **`degraded`** — expected in this minimal deploy (no DB/Redis).
- `https://<site>/` (marketing site) unchanged.

## Later: full stack for M1–M4
Add these to the project and set the matching vars on the api (+ a worker) service:
- **Postgres + pgvector** → `DATABASE_URL` (pgvector-capable image/template).
- **Redis** → `REDIS_URL`, plus a **worker** service (root `backend`, start `python -m app.workers.worker`).
- **S3-compatible storage** (Railway has no native S3 — Scaleway/OVH or a MinIO service) →
  `S3_ENDPOINT_URL`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_DCE`.
- **Anthropic** → `ANTHROPIC_API_KEY`.

## Local run (before pushing)
```bash
docker compose up                       # backend API on :8000
cd site-presentation && npm run dev      # site on :3000
# open http://localhost:3000/dce → login → console
# (login needs the backend; set frontend NEXT_PUBLIC_API_URL if not localhost:8000)
```
The console reads `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). To point the local site at a
different API, create `site-presentation/.env.local` with `NEXT_PUBLIC_API_URL=...`.
