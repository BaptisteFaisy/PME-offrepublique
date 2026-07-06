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

## Plusieurs comptes ChatGPT (failover automatique sur limite)

Un serveur = **un** compte ChatGPT (un seul `--auth-json`). Quand ce compte
atteint sa limite d'usage Codex, l'API renvoie **429** et l'analyse s'arrête. Pour
enchaîner sur un autre compte, on déploie **une instance par compte** et le web
service bascule tout seul sur la suivante en cas de 429 (repli côté client, voir
`site-presentation/src/lib/dce/llm.ts`).

1. **Déploie une 2ᵉ instance** de ce service (même repo, Root Directory
   `codex-llm-server`). Donne-lui son propre `CODEX_AUTH_JSON` (compte B) et le
   **même** `LLM_API_KEY` que la 1ʳᵉ. Pin son `PORT` (ex. `18080`).
2. **Génère l'auth du compte B** dans un home isolé, sans toucher au compte A :

   ```powershell
   # depuis codex-llm-server/ — connecte-toi au compte B dans le navigateur
   ./refresh-dce.ps1 -Slot b -Service <nom-du-service-b>
   ```

   `-Slot b` épingle `CODEX_HOME` sur `~/.codex-dce-b`. `-Service` est
   **obligatoire** avec `-Slot` : dès que plusieurs services partagent le Root
   Directory `codex-llm-server`, l'auto-détection ne peut plus les distinguer.
3. **Sur le web service** (`site-presentation`), remplace `DCE_LLM_BASE_URL` par la
   **liste** ordonnée des endpoints (le 1ᵉʳ est prioritaire) :

   | Variable | Value |
   |---|---|
   | `DCE_LLM_BASE_URLS` | `http://codex-llm-server.railway.internal:18080/v1,http://codex-llm-server-b.railway.internal:18080/v1` |
   | `DCE_LLM_API_KEY` | *le `LLM_API_KEY` commun aux deux services* |

   `DCE_LLM_BASE_URLS` (pluriel, séparé par des virgules) prime ; `DCE_LLM_BASE_URL`
   (singulier) reste un repli si la liste est absente. Ajoute autant d'URLs que de
   comptes.

**Comportement :** sur un 429, l'endpoint épuisé est mis en *cooldown*
(`DCE_LLM_COOLDOWN_MS`, défaut 15 min, ou l'en-tête `Retry-After` s'il est fourni)
et les appels suivants partent directement sur le compte disponible. Quand **tous**
les comptes sont au taquet, l'erreur renvoyée le dit explicitement. Les erreurs qui
ne sont pas des limites (401, réseau, JSON invalide) **ne** déclenchent pas de
bascule — inutile de brûler un autre compte pour un problème qui n'est pas une
limite.

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
