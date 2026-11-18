import os
import asyncio
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _BACKEND_DIR.parent
load_dotenv(dotenv_path=_BACKEND_DIR / ".env", override=False)
load_dotenv(dotenv_path=_REPO_ROOT / ".env", override=False)

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "AuditGpt")

_client = None
_client_loop = None


def get_client() -> AsyncIOMotorClient:
    global _client, _client_loop
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if (
        _client is None
        or _client_loop is None
        or _client_loop.is_closed()
        or _client_loop != current_loop
    ):
        if _client is not None:
            _client.close()
        _client = AsyncIOMotorClient(
            MONGODB_URL,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
        )
        _client_loop = current_loop
    return _client


def close_client() -> None:
    """Close the active Mongo client during application shutdown."""
    global _client, _client_loop
    if _client is not None:
        _client.close()
        _client = None
        _client_loop = None


def get_database():
    return get_client()[DB_NAME]


class _ClientProxy:
    def __getattr__(self, name):
        return getattr(get_client(), name)

    def __getitem__(self, item):
        return get_client()[item]


class _DatabaseProxy:
    def __getattr__(self, name):
        return getattr(get_database(), name)

    def __getitem__(self, item):
        return get_database()[item]


class _CollectionProxy:
    def __init__(self, collection_name: str):
        self._collection_name = collection_name

    @property
    def _collection(self):
        return get_database()[self._collection_name]

    def __getattr__(self, name):
        return getattr(self._collection, name)

    def __getitem__(self, item):
        return self._collection[item]


client = _ClientProxy()
db = _DatabaseProxy()
users_collection = _CollectionProxy("users")
analyses_collection = _CollectionProxy("analyses")
portfolios_collection = _CollectionProxy("portfolios")
price_history_collection = _CollectionProxy("price_history")
sync_jobs_collection = _CollectionProxy("sync_jobs")
