"""Email/password authentication tests for AuditGPT."""

import os
import sys
from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from jose import jwt

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app
from services.auth import JWT_ALGORITHM, JWT_SECRET, create_access_token, hash_password

client = TestClient(app)


class MockAsyncCollection:
    def __init__(self, initial_docs=None):
        self.docs = list(initial_docs or [])

    async def find_one(self, query):
        for doc in self.docs:
            if all(doc.get(k) == v for k, v in query.items()):
                return dict(doc)
        return None

    async def insert_one(self, doc):
        if any(existing.get("email") == doc.get("email") for existing in self.docs):
            from pymongo.errors import DuplicateKeyError
            raise DuplicateKeyError("E11000 duplicate key")
        self.docs.append(dict(doc))
        return MagicMock(inserted_id="mock_id_123")

    async def update_one(self, query, update):
        for doc in self.docs:
            if all(doc.get(k) == v for k, v in query.items()):
                if "$set" in update:
                    doc.update(update["$set"])
                return MagicMock(modified_count=1)
        return MagicMock(modified_count=0)

    async def create_index(self, *args, **kwargs):
        return "email_1"


def _patch_users(mock_db):
    return (
        patch("routers.auth.users_collection", mock_db),
        patch("services.auth.users_collection", mock_db),
    )


def test_signup_success_issues_jwt():
    mock_db = MockAsyncCollection()
    auth_patch, me_patch = _patch_users(mock_db)
    with auth_patch, me_patch:
        resp = client.post(
            "/auth/signup",
            json={"name": "Ada Lovelace", "email": "ada@example.com", "password": "secret1"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "ada@example.com"
        assert data["user"]["name"] == "Ada Lovelace"
        assert data["user"]["provider"] == "local"
        claims = jwt.decode(data["access_token"], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        assert claims["sub"] == "ada@example.com"
        assert mock_db.docs[0]["password"] != "secret1"
        assert mock_db.docs[0]["password"].startswith("$2")


def test_signup_rejects_invalid_email():
    resp = client.post(
        "/auth/signup",
        json={"name": "Ada", "email": "not-an-email", "password": "secret1"},
    )
    assert resp.status_code == 422


def test_signup_rejects_missing_name():
    resp = client.post(
        "/auth/signup",
        json={"name": "   ", "email": "ada@example.com", "password": "secret1"},
    )
    assert resp.status_code == 422


def test_signup_rejects_short_password():
    resp = client.post(
        "/auth/signup",
        json={"name": "Ada", "email": "ada@example.com", "password": "123"},
    )
    assert resp.status_code == 422


def test_signup_duplicate_email():
    mock_db = MockAsyncCollection([
        {
            "name": "Ada",
            "email": "ada@example.com",
            "password": hash_password("secret1"),
            "provider": "local",
            "createdAt": "2026-01-01T00:00:00+00:00",
        }
    ])
    auth_patch, me_patch = _patch_users(mock_db)
    with auth_patch, me_patch:
        resp = client.post(
            "/auth/signup",
            json={"name": "Ada Two", "email": "ada@example.com", "password": "secret1"},
        )
        assert resp.status_code == 409
        assert "already exists" in resp.json()["detail"]


def test_signup_database_unavailable():
    mock_db = MagicMock()
    mock_db.find_one = AsyncMock(side_effect=Exception("connection refused"))
    auth_patch, me_patch = _patch_users(mock_db)
    with auth_patch, me_patch:
        resp = client.post(
            "/auth/signup",
            json={"name": "Ada", "email": "ada@example.com", "password": "secret1"},
        )
        assert resp.status_code == 503
        assert "Database connection is unavailable" in resp.json()["detail"]


def test_login_success():
    mock_db = MockAsyncCollection([
        {
            "name": "Ada",
            "email": "ada@example.com",
            "password": hash_password("secret1"),
            "provider": "local",
            "createdAt": "2026-01-01T00:00:00+00:00",
        }
    ])
    auth_patch, me_patch = _patch_users(mock_db)
    with auth_patch, me_patch:
        resp = client.post(
            "/auth/login",
            json={"email": "ada@example.com", "password": "secret1"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["email"] == "ada@example.com"
        claims = jwt.decode(data["access_token"], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        assert claims["sub"] == "ada@example.com"


def test_login_wrong_password():
    mock_db = MockAsyncCollection([
        {
            "name": "Ada",
            "email": "ada@example.com",
            "password": hash_password("secret1"),
            "provider": "local",
            "createdAt": "2026-01-01T00:00:00+00:00",
        }
    ])
    auth_patch, _ = _patch_users(mock_db)
    with auth_patch:
        resp = client.post(
            "/auth/login",
            json={"email": "ada@example.com", "password": "wrongpass"},
        )
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Invalid email or password"


def test_login_unknown_email():
    mock_db = MockAsyncCollection()
    auth_patch, _ = _patch_users(mock_db)
    with auth_patch:
        resp = client.post(
            "/auth/login",
            json={"email": "missing@example.com", "password": "secret1"},
        )
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Invalid email or password"


def test_login_missing_fields():
    resp = client.post("/auth/login", json={"email": "ada@example.com"})
    assert resp.status_code == 422


def test_login_google_only_account():
    mock_db = MockAsyncCollection([
        {
            "name": "Google User",
            "email": "google@example.com",
            "password": None,
            "provider": "google",
            "createdAt": "2026-01-01T00:00:00+00:00",
        }
    ])
    auth_patch, _ = _patch_users(mock_db)
    with auth_patch:
        resp = client.post(
            "/auth/login",
            json={"email": "google@example.com", "password": "secret1"},
        )
        assert resp.status_code == 401
        assert "Google Sign-In" in resp.json()["detail"]


def test_me_requires_authentication():
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_me_rejects_expired_token():
    token = create_access_token({"sub": "ada@example.com"}, expires_delta=timedelta(seconds=-10))
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401
    assert "Invalid or expired token" in resp.json()["detail"]


def test_me_success_after_login():
    mock_db = MockAsyncCollection([
        {
            "name": "Ada",
            "email": "ada@example.com",
            "password": hash_password("secret1"),
            "provider": "local",
            "createdAt": "2026-01-01T00:00:00+00:00",
        }
    ])
    auth_patch, me_patch = _patch_users(mock_db)
    with auth_patch, me_patch:
        login = client.post(
            "/auth/login",
            json={"email": "ada@example.com", "password": "secret1"},
        )
        token = login.json()["access_token"]
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["email"] == "ada@example.com"
