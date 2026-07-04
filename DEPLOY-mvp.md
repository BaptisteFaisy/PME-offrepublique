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

## Provisioning (Railway) — env vars on the web service

You already have the **web** service. Everything (login **and** the M1 engine) runs inside it — no
separate backend. Set these **runtime** variables on the web service (read server-side per request,
never sent to the browser; changing them needs no rebuild):

| Key | Value | Notes |
|---|---|---|
| `DCE_AUTH_USERS` | `user1:STRONG_PASS_1,user2:STRONG_PASS_2` | Console login credentials. `/dce` is public — use strong passwords. If unset in prod, **nobody can log in**. No comma in a password; ASCII only. |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | **Required for M1.** Piece classification + Fiche AO extraction. Without it, upload+extraction still work but the Fiche step fails with a clear message. |
| `DCE_LLM_MODEL` | `claude-sonnet-5` | Optional. Claude model for extraction (CDC picks Sonnet for cost). Use `claude-opus-4-8` for higher accuracy. |
| `DCE_DATA_DIR` | `/data` | Optional but recommended. Path to a **mounted Railway volume** for the M1 file store (uploads, extracted pages, fiches). Without a volume, records live in the container fs and are lost on redeploy. |

Then open `https://<site>/dce` → login with a pair → upload a DCE → Fiche AO + go/no-go. That's it.

## Local dev
```bash
cd site-presentation && npm run dev     # http://localhost:3000/dce
```
Login uses `DCE_AUTH_USERS` from `site-presentation/.env.local` (copy `.env.local.example`).
If unset in dev, a fallback of `baptiste:changeme` applies (dev only).

## M1 runs inside the web app (no separate service)
The M1 engine — DCE ingestion, page-anchored extraction, classification, two-pass Fiche AO extraction
via the Claude API, and go/no-go — is implemented in TypeScript inside this app
(`src/lib/dce/*`, exposed by the route handlers under `src/app/dce/api/uploads/*`). Long jobs run in
the background on the Node server (`next start`) and the client polls; results persist to the
`DCE_DATA_DIR` file store. This keeps the MVP a single deployable that ships on push to main.

- **Scanned PDFs**: pages with little/no extractable text are flagged in the Fiche's warnings (OCR is
  out of scope at the MVP — the page is signalled, never silently dropped).
- **Persistence**: the file store is fine for the 2-user MVP. If M2–M4 need relational + vector data
  (KB, RAG, isolation per client — CDC §4), the FastAPI app in `backend/` (still in the repo) is the
  path: deploy it as a second Railway service + Postgres/pgvector + Redis + S3 at that point.
