import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "auditgpt")

client = AsyncIOMotorClient(MONGODB_URL)
db = client[DB_NAME]
users_collection = db["users"]
analyses_collection = db["analyses"]
portfolios_collection = db["portfolios"]