# Quantum Portfolio Backend (v2)
Flask API + Celery + Redis + MongoDB. Exotic option pricing via classical models.

## Run
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit MONGO_URI if using Atlas
flask --app app.py run --debug --port 8000  # terminal 1
celery -A tasks.celery_app worker --loglevel=INFO  # terminal 2
```
