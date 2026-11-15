"""End-to-End integration test against real MongoDB instance."""

import os
import sys
import uuid
import pytest
from datetime import timedelta
from fastapi.testclient import TestClient
from jose import jwt

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app
from services.auth import JWT_SECRET, JWT_ALGORITHM, create_access_token

client = TestClient(app)


def test_e2e_live_auth_flow():
    test_id = uuid.uuid4().hex[:8]
    email = f"live.tester.{test_id}@example.com"
    name = "Live Test User"
    password = "SecurePassword123!"

    # 1. Validation tests
    resp_blank_name = client.post("/auth/signup", json={"name": "   ", "email": email, "password": password})
    assert resp_blank_name.status_code == 422, f"Expected 422 for blank name, got {resp_blank_name.status_code}"

    resp_invalid_email = client.post("/auth/signup", json={"name": name, "email": "not-an-email", "password": password})
    assert resp_invalid_email.status_code == 422, f"Expected 422 for invalid email, got {resp_invalid_email.status_code}"

    resp_short_pw = client.post("/auth/signup", json={"name": name, "email": email, "password": "123"})
    assert resp_short_pw.status_code == 422, f"Expected 422 for short password, got {resp_short_pw.status_code}"

    # 2. Successful Registration
    resp_signup = client.post("/auth/signup", json={"name": name, "email": email, "password": password})
    assert resp_signup.status_code == 201, f"Expected 201 for signup, got {resp_signup.status_code}: {resp_signup.text}"
    signup_data = resp_signup.json()
    assert "access_token" in signup_data
    assert signup_data["user"]["email"] == email
    assert signup_data["user"]["name"] == name
    assert signup_data["user"]["provider"] == "local"

    # Decode JWT to verify claims
    claims = jwt.decode(signup_data["access_token"], JWT_SECRET, algorithms=[JWT_ALGORITHM])
    assert claims["sub"] == email

    # 3. Duplicate Registration Prevention
    resp_dup = client.post("/auth/signup", json={"name": "Duplicate User", "email": email, "password": password})
    assert resp_dup.status_code == 409, f"Expected 409 for duplicate email, got {resp_dup.status_code}"
    assert "already exists" in resp_dup.json()["detail"].lower()

    # 4. Successful Login
    resp_login = client.post("/auth/login", json={"email": email, "password": password})
    assert resp_login.status_code == 200, f"Expected 200 for login, got {resp_login.status_code}"
    login_data = resp_login.json()
    assert "access_token" in login_data
    token = login_data["access_token"]
    assert login_data["user"]["email"] == email

    # 5. Login Failures
    resp_wrong_pw = client.post("/auth/login", json={"email": email, "password": "WrongPassword"})
    assert resp_wrong_pw.status_code == 401
    assert "Invalid email or password" in resp_wrong_pw.json()["detail"]

    resp_wrong_email = client.post("/auth/login", json={"email": "nonexistent@example.com", "password": password})
    assert resp_wrong_email.status_code == 401
    assert "Invalid email or password" in resp_wrong_email.json()["detail"]

    # 6. Protected Endpoint /auth/me
    resp_me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp_me.status_code == 200
    me_data = resp_me.json()
    assert me_data["email"] == email
    assert me_data["name"] == name

    # Also test /api/auth alias
    resp_me_alias = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp_me_alias.status_code == 200

    # 7. Unauthenticated & Invalid Tokens
    resp_no_token = client.get("/auth/me")
    assert resp_no_token.status_code == 401

    resp_bad_token = client.get("/auth/me", headers={"Authorization": "Bearer bad.token.here"})
    assert resp_bad_token.status_code == 401

    expired_token = create_access_token({"sub": email}, expires_delta=timedelta(seconds=-10))
    resp_expired = client.get("/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp_expired.status_code == 401

    # Clean up test user from live DB
    from database import users_collection
    import asyncio
    async def _cleanup():
        await users_collection.delete_one({"email": email})
    asyncio.run(_cleanup())
