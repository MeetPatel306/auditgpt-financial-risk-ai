<<<<<<< HEAD
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional


class UserSignup(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=72)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name is required")
        return stripped

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower() if isinstance(value, str) else value
=======
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str
>>>>>>> origin/main


class UserLogin(BaseModel):
    email: EmailStr
<<<<<<< HEAD
    password: str = Field(..., min_length=1)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower() if isinstance(value, str) else value


class GoogleAuthRequest(BaseModel):
    """Payload sent from the frontend after Google OAuth / GIS authentication."""
    id_token: Optional[str] = None      # Google ID token (from Google Identity Services)
    credential: Optional[str] = None    # Alias for id_token from GIS callback
    code: Optional[str] = None          # Authorization code if using OAuth 2.0 redirect code flow
    redirect_uri: Optional[str] = None  # Required if code is supplied
=======
    password: str
>>>>>>> origin/main


class UserResponse(BaseModel):
    name: str
    email: str
<<<<<<< HEAD
    createdAt: Optional[str] = None
    provider: Optional[str] = "local"
=======
    createdAt: str
>>>>>>> origin/main


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
