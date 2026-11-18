"""
Comprehensive Automated Test Suite for Google Authentication in AuditGPT.

Tests all 14 mandatory cases:
1. Successful verification of a valid Google identity.
2. Rejection of an invalid token.
3. Rejection of an expired token.
4. Rejection of a token with the wrong audience.
5. Handling of an unverified email.
6. Login of an existing Google-linked user.
7. Creation of a new Google user.
8. Handling of an existing password-based account (account conflict 409).
9. Prevention of duplicate users.
10. Successful generation of an AuditGPT JWT.
11. Access to a protected endpoint after login (/auth/me).
12. Logout / unauthenticated rejection on protected endpoints.
13. Missing OAuth configuration (503 Service Unavailable).
14. MongoDB database error handling (503 Service Unavailable).
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from jose import jwt
import os
import sys

# Ensure backend root is in sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app
from services.auth import JWT_SECRET, JWT_ALGORITHM

TEST_CLIENT_ID = "test-auditgpt-client-id.apps.googleusercontent.com"
client = TestClient(app)


class MockAsyncCollection:
    """In-memory async mock simulating Motor/MongoDB collection."""
    def __init__(self, initial_docs=None):
        self.docs = list(initial_docs or [])

    async def find_one(self, query):
        for doc in self.docs:
            match = True
            for k, v in query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                return dict(doc)
        return None

    async def insert_one(self, doc):
        self.docs.append(dict(doc))
        return MagicMock(inserted_id="mock_id_123")

    async def update_one(self, query, update):
        for doc in self.docs:
            match = True
            for k, v in query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                if "$set" in update:
                    doc.update(update["$set"])
                return MagicMock(modified_count=1)
        return MagicMock(modified_count=0)


@pytest.fixture(autouse=True)
def set_env():
    with patch.dict(os.environ, {
        "GOOGLE_CLIENT_ID": TEST_CLIENT_ID,
        "GOOGLE_CLIENT_SECRET": "test-client-secret-12345",
    }):
        yield


def test_01_successful_verification_of_valid_google_identity():
    """1. Successful verification of a valid Google identity."""
    mock_payload = {
        "iss": "https://accounts.google.com",
        "aud": TEST_CLIENT_ID,
        "sub": "google-sub-1001",
        "email": "analyst@example.com",
        "email_verified": True,
        "name": "Audit Analyst",
    }
    mock_db = MockAsyncCollection()

    with patch("routers.auth.id_token.verify_oauth2_token", return_value=mock_payload), \
         patch("routers.auth.users_collection", mock_db):
        resp = client.post("/auth/google", json={"id_token": "valid.mock.token"})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["email"] == "analyst@example.com"
        assert data["user"]["name"] == "Audit Analyst"
        assert data["user"]["provider"] == "google"


def test_02_rejection_of_invalid_token():
    """2. Rejection of an invalid token."""
    with patch("routers.auth.id_token.verify_oauth2_token", side_effect=ValueError("Invalid token signature")):
        resp = client.post("/auth/google", json={"id_token": "corrupted.fake.token"})
        assert resp.status_code == 401
        assert "could not be verified" in resp.json()["detail"]


def test_03_rejection_of_expired_token():
    """3. Rejection of an expired token."""
    with patch("routers.auth.id_token.verify_oauth2_token", side_effect=ValueError("Token used too late")):
        resp = client.post("/auth/google", json={"id_token": "expired.jwt.token"})
        assert resp.status_code == 401
        assert "could not be verified" in resp.json()["detail"]


def test_04_rejection_of_token_with_wrong_audience():
    """4. Rejection of a token with the wrong audience."""
    mock_payload = {
        "iss": "https://accounts.google.com",
        "aud": "attacker-client-id.apps.googleusercontent.com",  # Wrong audience
        "sub": "google-sub-1001",
        "email": "user@example.com",
        "email_verified": True,
        "name": "User",
    }
    with patch("routers.auth.id_token.verify_oauth2_token", return_value=mock_payload):
        resp = client.post("/auth/google", json={"id_token": "token.for.different.app"})
        assert resp.status_code == 401
        assert "could not be verified" in resp.json()["detail"]


def test_05_handling_of_unverified_email():
    """5. Handling of an unverified email."""
    mock_payload = {
        "iss": "https://accounts.google.com",
        "aud": TEST_CLIENT_ID,
        "sub": "google-sub-1001",
        "email": "unverified@example.com",
        "email_verified": False,  # Unverified
        "name": "Unverified User",
    }
    with patch("routers.auth.id_token.verify_oauth2_token", return_value=mock_payload):
        resp = client.post("/auth/google", json={"id_token": "unverified.email.token"})
        assert resp.status_code == 400
        assert "Google account email is not verified" in resp.json()["detail"]


def test_06_login_of_existing_google_linked_user():
    """6. Login of an existing Google-linked user."""
    mock_db = MockAsyncCollection([
        {
            "name": "Existing Google User",
            "email": "existing@example.com",
            "google_id": "google-sub-9999",
            "provider": "google",
            "password": None,
            "createdAt": "2026-01-01T00:00:00",
        }
    ])
    mock_payload = {
        "iss": "https://accounts.google.com",
        "aud": TEST_CLIENT_ID,
        "sub": "google-sub-9999",
        "email": "existing@example.com",
        "email_verified": True,
        "name": "Existing Google User",
    }
    with patch("routers.auth.id_token.verify_oauth2_token", return_value=mock_payload), \
         patch("routers.auth.users_collection", mock_db):
        resp = client.post("/auth/google", json={"id_token": "valid.existing.token"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["email"] == "existing@example.com"
        # Assert no duplicate created
        assert len(mock_db.docs) == 1


def test_07_creation_of_new_google_user():
    """7. Creation of a new Google user."""
    mock_db = MockAsyncCollection()
    mock_payload = {
        "iss": "https://accounts.google.com",
        "aud": TEST_CLIENT_ID,
        "sub": "google-sub-new-123",
        "email": "newbie@example.com",
        "email_verified": True,
        "name": "New Google User",
    }
    with patch("routers.auth.id_token.verify_oauth2_token", return_value=mock_payload), \
         patch("routers.auth.users_collection", mock_db):
        resp = client.post("/auth/google", json={"id_token": "valid.new.token"})
        assert resp.status_code == 200
        assert len(mock_db.docs) == 1
        created = mock_db.docs[0]
        assert created["email"] == "newbie@example.com"
        assert created["provider"] == "google"
        assert created["google_id"] == "google-sub-new-123"
        assert created["password"] is None
        assert created["role"] == "user"  # Never admin


def test_08_handling_of_existing_password_based_account():
    """8. Handling of an existing password-based account (account conflict 409)."""
    mock_db = MockAsyncCollection([
        {
            "name": "Password User",
            "email": "password.user@example.com",
            "password": "$2b$12$eX4mpleHashedPasswordHere",
            "google_id": None,
            "provider": "local",
            "createdAt": "2026-01-01T00:00:00",
        }
    ])
    mock_payload = {
        "iss": "https://accounts.google.com",
        "aud": TEST_CLIENT_ID,
        "sub": "google-sub-intruder-555",
        "email": "password.user@example.com",
        "email_verified": True,
        "name": "Google User",
    }
    with patch("routers.auth.id_token.verify_oauth2_token", return_value=mock_payload), \
         patch("routers.auth.users_collection", mock_db):
        resp = client.post("/auth/google", json={"id_token": "conflict.token"})
        assert resp.status_code == 409
        assert "already exists using password authentication" in resp.json()["detail"]


def test_09_prevention_of_duplicate_users():
    """9. Prevention of duplicate users across repeated logins."""
    mock_db = MockAsyncCollection()
    mock_payload = {
        "iss": "https://accounts.google.com",
        "aud": TEST_CLIENT_ID,
        "sub": "google-sub-stable-777",
        "email": "stable@example.com",
        "email_verified": True,
        "name": "Stable User",
    }
    with patch("routers.auth.id_token.verify_oauth2_token", return_value=mock_payload), \
         patch("routers.auth.users_collection", mock_db):
        # First sign-in
        resp1 = client.post("/auth/google", json={"id_token": "token.1"})
        assert resp1.status_code == 200
        assert len(mock_db.docs) == 1

        # Second sign-in with same identity
        resp2 = client.post("/auth/google", json={"id_token": "token.2"})
        assert resp2.status_code == 200
        assert len(mock_db.docs) == 1  # Still exactly one


def test_10_successful_generation_of_auditgpt_jwt():
    """10. Successful generation of an AuditGPT JWT with valid claims."""
    mock_db = MockAsyncCollection()
    mock_payload = {
        "iss": "https://accounts.google.com",
        "aud": TEST_CLIENT_ID,
        "sub": "google-sub-jwt-test",
        "email": "jwt.test@example.com",
        "email_verified": True,
        "name": "JWT Test",
    }
    with patch("routers.auth.id_token.verify_oauth2_token", return_value=mock_payload), \
         patch("routers.auth.users_collection", mock_db):
        resp = client.post("/auth/google", json={"id_token": "token.for.jwt"})
        assert resp.status_code == 200
        token = resp.json()["access_token"]

        # Decode using application's secret and algorithm
        claims = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        assert claims["sub"] == "jwt.test@example.com"
        assert "exp" in claims


def test_11_access_to_protected_endpoint_after_login():
    """11. Access to a protected endpoint (/auth/me) after Google login."""
    mock_db = MockAsyncCollection([
        {
            "name": "Protected Analyst",
            "email": "analyst.protected@example.com",
            "password": None,
            "google_id": "google-sub-protected",
            "provider": "google",
            "createdAt": "2026-02-01T00:00:00",
        }
    ])
    mock_payload = {
        "iss": "https://accounts.google.com",
        "aud": TEST_CLIENT_ID,
        "sub": "google-sub-protected",
        "email": "analyst.protected@example.com",
        "email_verified": True,
        "name": "Protected Analyst",
    }
    with patch("routers.auth.id_token.verify_oauth2_token", return_value=mock_payload), \
         patch("routers.auth.users_collection", mock_db), \
         patch("services.auth.users_collection", mock_db):
        # 1. Login with Google
        login_resp = client.post("/auth/google", json={"id_token": "token.protected"})
        token = login_resp.json()["access_token"]

        # 2. Access /auth/me with Bearer token
        me_resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.status_code == 200
        me_data = me_resp.json()
        assert me_data["email"] == "analyst.protected@example.com"
        assert me_data["name"] == "Protected Analyst"


def test_12_logout_behavior():
    """12. Logout / rejection of unauthenticated access on protected endpoints."""
    # Without Authorization header
    resp = client.get("/auth/me")
    assert resp.status_code == 403 or resp.status_code == 401

    # With invalid Bearer token
    resp_invalid = client.get("/auth/me", headers={"Authorization": "Bearer invalid.garbage.token"})
    assert resp_invalid.status_code == 401


def test_13_missing_oauth_configuration():
    """13. Missing OAuth configuration returns 503 Service Unavailable."""
    with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": ""}):
        resp = client.post("/auth/google", json={"id_token": "any.token"})
        assert resp.status_code == 503
        assert "Google Sign-In is not configured" in resp.json()["detail"]


def test_14_mongodb_errors():
    """14. MongoDB database error handling returns 503 Service Unavailable."""
    mock_payload = {
        "iss": "https://accounts.google.com",
        "aud": TEST_CLIENT_ID,
        "sub": "google-sub-dberr",
        "email": "dberr@example.com",
        "email_verified": True,
        "name": "DB Err User",
    }
    mock_db = MagicMock()
    mock_db.find_one = AsyncMock(side_effect=Exception("Connection timed out to MongoDB"))

    with patch("routers.auth.id_token.verify_oauth2_token", return_value=mock_payload), \
         patch("routers.auth.users_collection", mock_db):
        resp = client.post("/auth/google", json={"id_token": "token.dberr"})
        assert resp.status_code == 503
        assert "Database connection is unavailable" in resp.json()["detail"]
