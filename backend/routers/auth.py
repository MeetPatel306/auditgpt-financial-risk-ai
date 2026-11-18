<<<<<<< HEAD
import logging
import os
import requests as http_requests
from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timezone
from pymongo.errors import DuplicateKeyError
try:
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
except ImportError:
    id_token = None
    google_requests = None
from models.user import UserSignup, UserLogin, UserResponse, TokenResponse, GoogleAuthRequest
from services.auth import hash_password, verify_password, create_access_token, get_current_user
from database import users_collection

logger = logging.getLogger("auditgpt.auth")

router = APIRouter()

# ── Helpers ────────────────────────────────────────────────────────────────────

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


def _google_client_id() -> str:
    return os.getenv("GOOGLE_CLIENT_ID", "").strip() or os.getenv("VITE_GOOGLE_CLIENT_ID", "").strip()


def _google_client_secret() -> str:
    return os.getenv("GOOGLE_CLIENT_SECRET", "").strip()


# ── Standard email/password routes (unchanged) ─────────────────────────────────

@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(user: UserSignup):
    email = user.email.lower()

    try:
        existing = await users_collection.find_one({"email": email})
    except Exception:
        logger.exception("Database unavailable during registration lookup")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is unavailable",
        )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    try:
        hashed = hash_password(user.password)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password does not meet the requirements",
        )
    except Exception:
        logger.exception("Password hashing failed during registration")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create account. Please try again later.",
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "name": user.name.strip(),
        "email": email,
        "password": hashed,
        "provider": "local",
        "role": "user",
        "createdAt": now_iso,
    }
    try:
        await users_collection.insert_one(user_doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )
    except Exception:
        logger.exception("Database error during registration insert")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is unavailable",
        )

=======
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import JSONResponse
from datetime import datetime
from models.user import UserSignup, UserLogin, UserResponse, TokenResponse
from services.auth import hash_password, verify_password, create_access_token, get_current_user
from database import users_collection

router = APIRouter()

@router.options("/signup")
async def signup_options():
    """Handle preflight requests for signup"""
    return JSONResponse(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    )

@router.post("/signup", response_model=TokenResponse)
async def signup(user: UserSignup):
    # Check if name is provided
    if not user.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name is required"
        )

    # Check password length
    if len(user.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters"
        )

    # Check if email already exists
    existing = await users_collection.find_one({"email": user.email.lower()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists"
        )

    # Create user document
    now = datetime.utcnow()
    user_doc = {
        "name": user.name.strip(),
        "email": user.email.lower(),
        "password": hash_password(user.password),
        "createdAt": now.isoformat(),
    }
    await users_collection.insert_one(user_doc)

    # Generate JWT
>>>>>>> origin/main
    token = create_access_token({"sub": user_doc["email"]})

    return TokenResponse(
        access_token=token,
        user=UserResponse(
            name=user_doc["name"],
            email=user_doc["email"],
            createdAt=user_doc["createdAt"],
<<<<<<< HEAD
            provider="local",
        )
    )


@router.post("/login", response_model=TokenResponse)
async def login(user: UserLogin):
    try:
        db_user = await users_collection.find_one({"email": user.email.lower()})
    except Exception:
        logger.exception("Database unavailable during login")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is unavailable",
        )

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not db_user.get("password"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account uses Google Sign-In. Please continue with Google.",
        )

    if not verify_password(user.password, db_user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

=======
        )
    )

@router.options("/login")
async def login_options():
    """Handle preflight requests for login"""
    return JSONResponse(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    )

@router.post("/login", response_model=TokenResponse)
async def login(user: UserLogin):
    # Find user by email
    db_user = await users_collection.find_one({"email": user.email.lower()})
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Verify password
    if not verify_password(user.password, db_user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Generate JWT
>>>>>>> origin/main
    token = create_access_token({"sub": db_user["email"]})

    return TokenResponse(
        access_token=token,
        user=UserResponse(
<<<<<<< HEAD
            name=db_user.get("name", "User"),
            email=db_user["email"],
            createdAt=str(db_user.get("createdAt") or ""),
            provider=db_user.get("provider", "local"),
=======
            name=db_user["name"],
            email=db_user["email"],
            createdAt=db_user["createdAt"],
>>>>>>> origin/main
        )
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
<<<<<<< HEAD
        name=current_user.get("name", "User"),
        email=current_user["email"],
        createdAt=str(current_user.get("createdAt") or ""),
        provider=current_user.get("provider", "local"),
    )


# ── Google Authentication (Production Identity Services + OAuth 2.0) ──────────

def _verify_id_token_payload(raw_id_token: str, client_id: str) -> dict:
    """
    Independently verify the Google ID token using Google's verification library.
    Validates token signature, expiration, issuer, audience, and email claim.
    """
    if not id_token or not google_requests:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="google-auth library is not installed on this server."
        )

    try:
        payload = id_token.verify_oauth2_token(
            raw_id_token,
            google_requests.Request(),
            client_id,
            clock_skew_in_seconds=10,
        )
    except ValueError as exc:
        logger.warning("Google ID token rejected: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authentication could not be verified",
        )
    except Exception:
        logger.exception("Google ID token verification failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authentication could not be verified",
        )

    # Verify issuer
    issuer = payload.get("iss", "")
    if issuer not in ("accounts.google.com", "https://accounts.google.com"):
        logger.warning("Google ID token issuer mismatch: %s", issuer)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authentication could not be verified",
        )

    # Verify audience
    audience = payload.get("aud", "")
    if audience != client_id:
        logger.warning("Google ID token audience mismatch")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authentication could not be verified",
        )

    # Verify email
    email = (payload.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google ID token does not contain an email address."
        )

    # Verify email_verified
    raw_verified = payload.get("email_verified")
    is_verified = (raw_verified is True) or (isinstance(raw_verified, str) and raw_verified.lower() == "true")
    if not is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account email is not verified."
        )

    # Verify subject identifier
    sub = payload.get("sub", "")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google ID token does not contain a subject identifier."
        )

    return payload


@router.post("/google", response_model=TokenResponse)
async def google_auth(payload: GoogleAuthRequest):
    """
    Production Google Sign-In endpoint.

    Supported flows:
    1. Google Identity Services (GIS) ID Token flow (Preferred):
       Receives verified `id_token` (or `credential`) from GIS.
    2. Google OAuth 2.0 Authorization Code flow:
       Receives `code` + `redirect_uri` and exchanges it server-side for an ID token.

    Security guarantees:
    - Never trusts unverified frontend claims; email, name, and identity are extracted
      only from cryptographically verified Google ID tokens.
    - Validates token signature, expiration, issuer (accounts.google.com), audience (GOOGLE_CLIENT_ID),
      and verified email status.
    - Prevents account-hijacking: if an account with this email was registered using a password,
      it is NOT automatically overwritten or linked without credential validation (returns 409 Conflict).
    - Prevents duplicate accounts; generates a standard AuditGPT application JWT upon success.
    - Returns no sensitive provider secrets.
    """
    configured_client_id = _google_client_id()
    if not configured_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Sign-In is not configured"
        )

    raw_id_token = payload.id_token or payload.credential

    # If an authorization code was provided instead of an ID token, exchange it
    if not raw_id_token and payload.code:
        configured_client_secret = _google_client_secret()
        if not configured_client_secret:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google authorization code flow requires GOOGLE_CLIENT_SECRET on the server."
            )

        if not payload.redirect_uri:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing redirect_uri for Google authorization code exchange."
            )

        try:
            token_response = http_requests.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": payload.code,
                    "client_id": configured_client_id,
                    "client_secret": configured_client_secret,
                    "redirect_uri": payload.redirect_uri,
                    "grant_type": "authorization_code",
                },
                timeout=10,
            )
        except http_requests.RequestException as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Network error communicating with Google token endpoint: {str(exc)}"
            )

        if not token_response.ok:
            error_body = token_response.json() if token_response.headers.get("content-type", "").startswith("application/json") else {}
            error_desc = error_body.get("error_description", f"Status {token_response.status_code}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Google authorization code exchange failed: {error_desc}"
            )

        token_data = token_response.json()
        raw_id_token = token_data.get("id_token")

    if not raw_id_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google ID token or authorization code."
        )

    # Independently verify the ID token
    id_info = _verify_id_token_payload(raw_id_token, configured_client_id)

    google_email = id_info["email"].lower().strip()
    google_name = id_info.get("name") or google_email.split("@")[0]
    google_sub = id_info["sub"]

    # --- Database operations with account-linking protection ---
    try:
        db_user = await users_collection.find_one({"google_id": google_sub})
        if db_user is None:
            db_user = await users_collection.find_one({"email": google_email})
    except Exception:
        logger.exception("Database unavailable during Google authentication")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is unavailable",
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    created_new_user = False

    if db_user is None:
        # Case 1: New user — create account linked to Google identity
        user_doc = {
            "name": google_name,
            "email": google_email,
            "password": None,           # Google-only account has no password
            "provider": "google",
            "google_id": google_sub,
            "role": "user",
            "createdAt": now_iso,
        }
        try:
            await users_collection.insert_one(user_doc)
            db_user = user_doc
            created_new_user = True
        except DuplicateKeyError:
            db_user = await users_collection.find_one({"email": google_email})
            if db_user is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email already exists",
                )
        except Exception:
            logger.exception("Database error creating Google user account")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database connection is unavailable",
            )

    if not created_new_user:
        # Case 2: Existing user with same email or Google subject
        if db_user.get("password") and not db_user.get("google_id"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists using password authentication. Please log in with your email and password."
            )

        if db_user.get("google_id") and db_user.get("google_id") != google_sub:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account is linked to a different Google identity."
            )

        if not db_user.get("google_id"):
            try:
                await users_collection.update_one(
                    {"email": google_email},
                    {"$set": {"google_id": google_sub, "provider": "google"}}
                )
                db_user["google_id"] = google_sub
                db_user["provider"] = "google"
            except Exception:
                logger.exception("Database error updating Google identity")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Database connection is unavailable",
                )

    # --- Generate standard application JWT ---
    app_token = create_access_token({"sub": db_user["email"]})

    return TokenResponse(
        access_token=app_token,
        user=UserResponse(
            name=db_user["name"],
            email=db_user["email"],
            createdAt=db_user.get("createdAt", now_iso),
            provider=db_user.get("provider", "google"),
        )
=======
        name=current_user["name"],
        email=current_user["email"],
        createdAt=current_user["createdAt"],
>>>>>>> origin/main
    )
