# Deploying the internal console at `https://pme-offrepublique-production.up.railway.app/dce`

**One service. One environment.** The marketing site and the internal console are the same Next.js
app (`site-presentation`). The console lives at `/dce` (`src/app/dce/`) and handles its own login via
same-origin server route handlers (`src/app/dce/api/*` + `src/lib/auth.ts`) — **no separate backend,
no CORS, no `NEXT_PUBLIC_API_URL`.**

```
web (site-presentation)   https://pme-offrepublique-production.up.railway.app/      → marketing site
                          https://pme-offrepublique-production.up.railway.app/dce   → login → internal console
                          https://pme-offrepublique-production.up.railway.app/dce/api/{login,me,logout}  → auth (same origin)
```

## Provisioning (Railway) — env vars on the web service

You already have the **web** service. Everything (login **and** the M1 engine) runs inside it — no
separate backend. Set these **runtime** variables on the web service (read server-side per request,
never sent to the browser; changing them needs no rebuild):

| Key | Value | Notes |
|---|---|---|
| `DCE_AUTH_USERS` | `user1:STRONG_PASS_1,user2:STRONG_PASS_2` | Console login credentials. `/dce` is public — use strong passwords. If unset in prod, **nobody can log in**. No comma in a password; ASCII only. |
| `DCE_LLM_BASE_URL` | `https://codex.example/v1` | **Required on Railway.** OpenAI-compatible endpoint (must end in `/v1`). Local default is `http://127.0.0.1:18080/v1` (the `openai-api-server-via-codex` server), which **the Railway container cannot reach** — override it with a reachable Codex server (2nd Railway service via private networking, or a public tunnel) or any other OpenAI-compatible endpoint. |
| `DCE_LLM_API_KEY` | `local-secret` | Bearer key for the endpoint above. The local Codex server ignores it **unless** started with `--api-key`; set it to match when the endpoint requires auth (recommended whenever the server is exposed beyond localhost). `OPENAI_API_KEY` is honoured as a fallback. |
| `DCE_LLM_MODEL` | `gpt-5.5` | Optional. Default `gpt-5.5`. Any model the endpoint serves (e.g. `gpt-5.3-codex-spark`, or a standard OpenAI id when pointing at `api.openai.com`). |
| `DCE_LLM_MAX_TOKENS` | `32000` | Optional. Max completion tokens. Kept large because reasoning is pinned to `xhigh`, which spends many tokens before emitting the answer — too low truncates the JSON mid-reasoning. |
| `DCE_DATA_DIR` | `/data` | Optional but recommended. Path to a **mounted Railway volume** for the M1 file store (uploads, extracted pages, fiches). Without a volume, records live in the container fs and are lost on redeploy. |

Then open `https://pme-offrepublique-production.up.railway.app/dce` → login with a pair → upload a DCE → Fiche AO + go/no-go. That's it.

## Local dev
```bash
cd site-presentation && npm run dev     # http://localhost:3000/dce
```
Login uses `DCE_AUTH_USERS` from `site-presentation/.env.local` (copy `.env.local.example`).
If unset in dev, a fallback of `baptiste:changeme` applies (dev only).

## M1 runs inside the web app (no separate service)
The M1 engine — DCE ingestion, page-anchored extraction, classification, two-pass Fiche AO extraction
via the LLM (Codex-backed GPT over an OpenAI-compatible API, `gpt-5.5` at `xhigh` reasoning by default),
and go/no-go — is implemented in TypeScript inside this app
(`src/lib/dce/*`, exposed by the route handlers under `src/app/dce/api/uploads/*`). Long jobs run in
the background on the Node server (`next start`) and the client polls; results persist to the
`DCE_DATA_DIR` file store. This keeps the MVP a single deployable that ships on push to main.

### LLM provider: `openai-api-server-via-codex`
The engine speaks the **OpenAI** API (`/v1/chat/completions`). It is meant to run against
[`openai-api-server-via-codex`](https://pypi.org/project/openai-api-server-via-codex/), a local
OpenAI-compatible server that borrows your ChatGPT **Codex** login (`~/.codex/auth.json`) to reach the
GPT models — no per-token API bill.

- **Prerequisite:** a working Codex login. The server *exits before binding its port* if `~/.codex/auth.json`
  is missing/expired. Create it once with the Codex CLI (`codex login`).
- **Local dev:** start it with the `OpenAI API Server (Codex)` dev command (`uvx openai-api-server-via-codex`),
  then `npm run dev`. Nothing else to configure — `DCE_LLM_BASE_URL` defaults to `http://127.0.0.1:18080/v1`.
- **Railway (production):** the container **cannot reach your laptop's `127.0.0.1`**. Make a Codex server
  reachable and point `DCE_LLM_BASE_URL` at it. Two supported shapes:
  1. **2nd Railway service** (recommended) — a ready-made service lives in
     [`codex-llm-server/`](codex-llm-server/README.md): deploy it from this repo with Root Directory
     `codex-llm-server`, give it your Codex `auth.json` + an `LLM_API_KEY` secret, then point the web
     service at it over private networking:
     `DCE_LLM_BASE_URL=http://codex-llm-server.railway.internal:18080/v1` + `DCE_LLM_API_KEY=<same secret>`.
  2. **Public tunnel** to a Codex server you run elsewhere (bound to `0.0.0.0`, always set `--api-key`):
     `DCE_LLM_BASE_URL=https://<tunnel-host>/v1` + `DCE_LLM_API_KEY=<secret>`.

  Either way the web service stays a single deployable; only the two env vars change.

- **Scanned PDFs**: pages with little/no extractable text are rasterized and read by a vision-capable
  model (OCR). The Codex-backed GPT models accept image input, so this needs no extra service — just the
  same `DCE_LLM_BASE_URL`. Tunable via `DCE_OCR_ENABLED` (default on), `DCE_OCR_MODEL` (default `gpt-5.5`),
  `DCE_OCR_SCALE`, `DCE_OCR_MAX_PAGES`, `DCE_OCR_REASONING`. If OCR fails on a page, it's flagged in the
  Fiche's warnings — never silently dropped.
- **Persistence**: the file store is fine for the 2-user MVP. If M2–M4 need relational + vector data
  (KB, RAG, isolation per client — CDC §4), the FastAPI app in `backend/` (still in the repo) is the
  path: deploy it as a second Railway service + Postgres/pgvector + Redis + S3 at that point.
