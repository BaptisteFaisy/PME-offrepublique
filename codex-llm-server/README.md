# `codex-llm-server` — the M1 LLM endpoint

A tiny companion service that runs
[`openai-api-server-via-codex`](https://pypi.org/project/openai-api-server-via-codex/):
a **local OpenAI-compatible API** (`/v1/chat/completions`, …) backed by your
ChatGPT **Codex** login. The web app (`site-presentation`) calls it for M1
(classification + Fiche AO extraction) instead of a paid API — no per-token bill.

It listens on the **private** Railway network only and is always guarded by an
API key. The web service reaches it at
`http://<this-service>.railway.internal:<port>/v1`.

```
site-presentation (web)  ──private network──▶  codex-llm-server  ──▶  ChatGPT Codex backend
   DCE_LLM_BASE_URL ─────────────────────────────┘ (:: , /v1)
```

## Prerequisite: a Codex login (auth.json)

The server borrows the credentials in `~/.codex/auth.json`. You must create that
file once **on your machine** (it does not exist by default):

```bash
codex login          # Codex CLI → writes ~/.codex/auth.json
cat ~/.codex/auth.json   # copy the full JSON — you'll paste it into Railway
```

The JSON contains an access token **and** a refresh token; the server refreshes
tokens itself, so it keeps working as long as the refresh token stays valid.

## Railway setup (2nd service, private networking)

1. **New service → Deploy from repo**, same repo, and set its **Root Directory**
   to `codex-llm-server`. Railway picks up `railway.json` (Dockerfile build). No
   Railway healthcheck is configured on purpose: the server binds `::` (IPv6) for
   private networking, which Railway's HTTP healthcheck probe can't reach — so a
   healthcheck would wrongly fail the deploy even though the app is healthy.
2. On this **codex-llm-server** service, set variables:
   | Variable | Value |
   |---|---|
   | `CODEX_AUTH_JSON` | *paste the entire contents of your `~/.codex/auth.json`* |
   | `LLM_API_KEY` | a strong random secret (the bearer key) |
   | `PORT` | `18080` *(pin it so the URL below is deterministic)* |
   3. On the **web** service (`site-presentation`), set:
   | Variable | Value |
   |---|---|
   | `DCE_LLM_BASE_URL` | `http://codex-llm-server.railway.internal:18080/v1` |
   | `DCE_LLM_API_KEY` | *the same value as `LLM_API_KEY` above* |
   | `DCE_LLM_MODEL` | `gpt-5.5` *(optional — this is the default)* |

   > Use this service's actual name in the hostname if you renamed it
   > (`<name>.railway.internal`). Both services must be in the **same Railway
   > project/environment** to share the private network.
4. Deploy. Watch the codex-llm-server logs: a healthy start shows `Codex auth
   preflight OK` then `Uvicorn running on http://[::]:18080`. If the Codex auth is
   bad you'll see it exit before binding (Railway restarts it on failure). Once
   it's running, the web app's uploads will produce a Fiche AO.

## Notes & caveats

- **Bind host:** defaults to `::` (IPv6) because Railway private DNS is IPv6. If
  you ever expose this publicly, set `LLM_HOST=0.0.0.0` **and** keep `LLM_API_KEY`.
- **Never public without a key.** The whole point of `--api-key` is that anyone
  who can reach the port can otherwise use your Codex credentials.
- **Token refresh** is in-memory; on restart the server re-reads `CODEX_AUTH_JSON`.
  If ChatGPT invalidates the session, re-run `codex login` and update the secret.
- **ToS:** this runs your personal ChatGPT-Codex credentials on a server. Make
  sure that's acceptable for your account/plan before relying on it.

## Local smoke test (optional)

```bash
docker build -t codex-llm codex-llm-server
docker run --rm -p 18080:18080 \
  -e CODEX_AUTH_JSON="$(cat ~/.codex/auth.json)" \
  -e LLM_API_KEY=local-secret \
  -e LLM_HOST=0.0.0.0 \
  codex-llm
# then:
curl -s localhost:18080/healthz
curl -s localhost:18080/v1/models -H "Authorization: Bearer local-secret"
```
