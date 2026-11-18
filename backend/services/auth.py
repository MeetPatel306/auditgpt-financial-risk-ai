<<<<<<< HEAD
import logging
import os
from datetime import datetime, timedelta, timezone
=======
import os
from datetime import datetime, timedelta
>>>>>>> origin/main
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import users_collection

<<<<<<< HEAD
logger = logging.getLogger("auditgpt.auth")

=======
>>>>>>> origin/main
# Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "auditgpt-dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24
<<<<<<< HEAD
BCRYPT_MAX_BYTES = 72

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer token scheme — missing credentials should be 401, not 403
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    if len(password.encode("utf-8")) > BCRYPT_MAX_BYTES:
        raise ValueError("Password is too long")
=======

# Password hashing context - using Argon2 (no password length limit, more secure than bcrypt)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# Bearer token scheme
security = HTTPBearer()


def hash_password(password: str) -> str:
    """Hash password using Argon2 (no length limits, more secure)"""
>>>>>>> origin/main
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
<<<<<<< HEAD
    if not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        logger.exception("Password verification failed")
        return False
=======
    """Verify password using Argon2"""
    return pwd_context.verify(plain_password, hashed_password)
>>>>>>> origin/main


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
<<<<<<< HEAD
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=JWT_EXPIRATION_HOURS))
=======
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=JWT_EXPIRATION_HOURS))
>>>>>>> origin/main
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
<<<<<<< HEAD
=======
    token = credentials.credentials
>>>>>>> origin/main
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
<<<<<<< HEAD
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
=======
>>>>>>> origin/main
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

<<<<<<< HEAD
    try:
        user = await users_collection.find_one({"email": email})
    except Exception:
        logger.exception("Database error while validating session")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is unavailable",
        )
=======
    user = await users_collection.find_one({"email": email})
>>>>>>> origin/main
    if user is None:
        raise credentials_exception

    return user
