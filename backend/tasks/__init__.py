import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

BROKER = os.getenv(
    "CELERY_BROKER_URL", os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
)
BACKEND = os.getenv(
    "CELERY_RESULT_BACKEND", os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
)
celery_app = Celery(
    "quantum_portfolio",
    broker=BROKER,
    backend=BACKEND,
    include=[
        "tasks.option_pricing",
        "tasks.optimization",
    ],
)

celery_app.conf.update(
    timezone="UTC",
    task_track_started=True,  # mark as STARTED before RUNNING
)
