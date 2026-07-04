"""RQ queue wired to Redis."""

from __future__ import annotations

import functools

from redis import Redis
from rq import Queue

from app.config import get_settings

DEFAULT_QUEUE = "dce"


@functools.lru_cache
def get_redis() -> Redis:
    return Redis.from_url(get_settings().redis_url)


@functools.lru_cache
def get_queue() -> Queue:
    # Long jobs (parsing, OCR, extraction, generation) — never block the API.
    return Queue(DEFAULT_QUEUE, connection=get_redis(), default_timeout=1800)
