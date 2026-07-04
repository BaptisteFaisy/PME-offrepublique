# Deploying the internal console at `https://<site>/dce`

**One service. One environment.** The marketing site and the internal console are the same Next.js
app (`site-presentation`). The console lives at `/dce` (`src/app/dce/`) and handles its own login via
same-origin server route handlers (`src/app/dce/api/*` + `src/lib/auth.ts`) — **no separate backend,
no CORS, no `NEXT_PUBLIC_API_URL`.**

```
web (site-presentation)   https://<site>/       → marketing site
                          https://<site>/dce    → login → internal console
                          https://<site>/dce/api/{login,me,logout}  → auth (server, same origin)
```

## Provisioning (Railway) — a single variable

You already have the **web** service. To make the login work, set **one** variable on it:

| Key | Value | Notes |
|---|---|---|
| `DCE_AUTH_USERS` | `user1:STRONG_PASS_1,user2:STRONG_PASS_2` | The console login credentials. |

- **Runtime** variable (read server-side on each request), **not** build-time → changing it does **not**
  require a rebuild, and it is **never** sent to the browser.
- Format: `user:pass` pairs separated by commas. No comma inside a password; ASCII only.
- ⚠️ `/dce` is public — use strong passwords. If `DCE_AUTH_USERS` is unset in production, **nobody can
  log in** (there is no default outside dev).

Then open `https://<site>/dce` → login with a pair → console. That's it.

## Local dev
```bash
cd site-presentation && npm run dev     # http://localhost:3000/dce
```
Login uses `DCE_AUTH_USERS` from `site-presentation/.env.local` (copy `.env.local.example`).
If unset in dev, a fallback of `baptiste:changeme` applies (dev only).

## Later: the Python backend (M1–M4)
The real engine — DCE ingestion, LLM extraction, mémoire technique, storage, workers — is the FastAPI
app in `backend/` (kept in the repo, currently **not deployed**). When M1 starts, deploy it as a second
service (root `backend`, its `railway.json` + `$PORT` + CORS env are already prepared) plus Postgres +
pgvector, Redis, and S3 storage, and wire the console's data calls to it. The `/dce` login can then
either keep the Next-side session or forward it to the backend's HTTP Basic auth.
