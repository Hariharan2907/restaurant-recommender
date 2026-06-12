"""Background job worker: `python -m app.worker`.

Blocks on the Redis job queue and processes jobs one at a time. Run as a
separate process/service next to the API (e.g. a second Railway service with
the same image and this command). See app/jobs.py for job types.
"""

import asyncio
import logging
import signal

from app.cache import get_redis
from app.config import get_settings
from app.db import SessionLocal
from app.jobs import QUEUE_KEY, run_job
from app.logging_config import configure_logging

logger = logging.getLogger(__name__)

_POLL_TIMEOUT_S = 5


async def worker_loop(stop_event: asyncio.Event) -> None:
    redis = get_redis()
    logger.info("worker started, waiting on %s", QUEUE_KEY)
    while not stop_event.is_set():
        try:
            item = await redis.brpop(QUEUE_KEY, timeout=_POLL_TIMEOUT_S)
        except Exception as exc:  # noqa: BLE001 — keep polling through Redis blips
            logger.error("worker: redis unavailable, retrying: %s", exc)
            await asyncio.sleep(_POLL_TIMEOUT_S)
            continue
        if item is None:
            continue
        _, raw = item
        async with SessionLocal() as session:
            await run_job(session, raw)
    logger.info("worker stopped")


async def backfill() -> None:
    """Enqueue catch-up jobs: embeddings for restaurants missing them, review
    fetches for restaurants with no popular dishes yet. Also suitable as the
    nightly cron (PLAN.md): `python -m app.worker backfill`."""
    from sqlalchemy import select

    from app.jobs import (
        JOB_EMBED_RESTAURANT,
        enqueue,
        enqueue_restaurant_refresh,
    )
    from app.models.popular_dish import PopularDish
    from app.models.restaurant import Restaurant

    async with SessionLocal() as session:
        missing_embedding = (
            (
                await session.execute(
                    select(Restaurant.id).where(Restaurant.embedding.is_(None))
                )
            )
            .scalars()
            .all()
        )
        no_dishes = (
            (
                await session.execute(
                    select(Restaurant.id).where(
                        ~Restaurant.id.in_(select(PopularDish.restaurant_id))
                    )
                )
            )
            .scalars()
            .all()
        )

    for restaurant_id in missing_embedding:
        await enqueue(JOB_EMBED_RESTAURANT, {"restaurant_id": str(restaurant_id)})
    for restaurant_id in no_dishes:
        await enqueue_restaurant_refresh(restaurant_id)
    logger.info(
        "backfill enqueued: %d embeddings, %d review fetches",
        len(missing_embedding),
        len(no_dishes),
    )


def main() -> None:
    import sys

    configure_logging(get_settings())
    if len(sys.argv) > 1 and sys.argv[1] == "backfill":
        asyncio.run(backfill())
        return

    stop_event = asyncio.Event()
    loop = asyncio.new_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)
    try:
        loop.run_until_complete(worker_loop(stop_event))
    finally:
        loop.close()


if __name__ == "__main__":
    main()
