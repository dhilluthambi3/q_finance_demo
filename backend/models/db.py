import os
from pymongo import MongoClient, ASCENDING
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "quantum_portfolio")
_client = MongoClient(MONGO_URI)
db = _client[MONGO_DB]
db.clients.create_index([("name", ASCENDING)])
db.portfolios.create_index([("clientId", ASCENDING)])
db.assets.create_index([("portfolioId", ASCENDING)])
db.jobs.create_index([("createdAt", ASCENDING)])
