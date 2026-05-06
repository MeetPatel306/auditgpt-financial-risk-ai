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
    token = create_access_token({"sub": user_doc["email"]})

    return TokenResponse(
        access_token=token,
        user=UserResponse(
            name=user_doc["name"],
            email=user_doc["email"],
            createdAt=user_doc["createdAt"],
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
    token = create_access_token({"sub": db_user["email"]})

    return TokenResponse(
        access_token=token,
        user=UserResponse(
            name=db_user["name"],
            email=db_user["email"],
            createdAt=db_user["createdAt"],
        )
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        name=current_user["name"],
        email=current_user["email"],
        createdAt=current_user["createdAt"],
    )
