# Companion LLM service for M1.
#
# Runs `openai-api-server-via-codex` — a local OpenAI-compatible API server that
# borrows your ChatGPT *Codex* login to reach the GPT models. The web app
# (site-presentation) calls this over Railway private networking; it is never
# exposed publicly (always guarded by --api-key). See README.md for setup.

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_NO_CACHE=1 \
    PATH="/root/.local/bin:${PATH}"

# uv provides the resolver + `uv tool install` used to install the server.
RUN pip install --upgrade pip && pip install uv

# Install the server at build time so the image fails loudly if the package can't
# resolve, and the first request isn't slowed by a cold `uvx` resolve. Pinned for
# reproducible builds; bump deliberately (the CLI's `serve` subcommand is stable).
ARG SERVER_VERSION="0.1.3"
RUN if [ -n "$SERVER_VERSION" ]; then \
        uv tool install "openai-api-server-via-codex==${SERVER_VERSION}"; \
    else \
        uv tool install "openai-api-server-via-codex"; \
    fi \
    && openai-api-server-via-codex --version

WORKDIR /app
COPY entrypoint.sh /app/entrypoint.sh

# EXPOSE is documentation only; the real port is ${PORT} (Railway-injected) or
# 18080. Bind host defaults to :: so Railway private networking (IPv6) can reach it.
EXPOSE 18080

ENTRYPOINT ["sh", "/app/entrypoint.sh"]
