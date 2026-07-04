"""RQ worker entrypoint:  python -m app.workers.worker"""

from __future__ import annotations

from rq import Worker

from app.config import get_settings
from app.logging_config import setup_logging
from app.workers.queue import DEFAULT_QUEUE, get_redis


def main() -> None:
    setup_logging(get_settings().log_level)
    worker = Worker([DEFAULT_QUEUE], connection=get_redis())
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
