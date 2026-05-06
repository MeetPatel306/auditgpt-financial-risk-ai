from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    name: str
    email: str
    createdAt: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
