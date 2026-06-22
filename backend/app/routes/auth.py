from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, hash_password, create_access_token
from app.core.deps import get_current_user
from app.models.user import User
from app.core.config import settings
from app.schemas.auth import UserRegister, Token, UserResponse, UserLogin, GoogleLogin

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    # Check if user already exists
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists."
        )

    # Create new user
    new_user = User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        dob=user_in.dob,
        gender=user_in.gender,
        role=user_in.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Authenticate user
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password."
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is inactive."
        )

    # Generate access token
    access_token = create_access_token(subject=str(user.id))
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login-json", response_model=Token)
def login_json(user_in: UserLogin, db: Session = Depends(get_db)):
    # Alternative login endpoint using JSON request body
    user = db.query(User).filter(User.email == user_in.email).first()
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password."
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is inactive."
        )

    access_token = create_access_token(subject=str(user.id))
    return {"access_token": access_token, "token_type": "bearer"}


import urllib.request
import urllib.parse
import json
from datetime import datetime, timezone

def verify_google_token(token: str) -> dict | None:
    try:
        url = "https://oauth2.googleapis.com/tokeninfo?" + urllib.parse.urlencode({"id_token": token})
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            # Verify issuer is Google
            if data.get("iss") not in ["accounts.google.com", "https://accounts.google.com"]:
                print("Issuer verification failed")
                return None
            # Verify client ID if configured
            client_id = settings.GOOGLE_CLIENT_ID
            if client_id and client_id not in ["", "your-google-client-id.apps.googleusercontent.com"]:
                if data.get("aud") != client_id:
                    print("Audience verification failed")
                    return None
            return data
    except Exception as e:
        print(f"Error verifying Google ID token: {e}")
        return None

@router.post("/google")
def google_auth(payload: GoogleLogin, db: Session = Depends(get_db)):
    claims = verify_google_token(payload.token)
    if not claims:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Google ID token."
        )

    email = claims.get("email")
    google_id = claims.get("sub")
    full_name = claims.get("name")
    avatar = claims.get("picture")
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google ID token does not contain email."
        )

    # 1. Search for user by google_id
    user = db.query(User).filter(User.google_id == google_id).first()
    if user:
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User account is inactive."
            )
        user.last_login_at = datetime.now(timezone.utc)
        db.commit()
        access_token = create_access_token(subject=str(user.id))
        return {"access_token": access_token, "token_type": "bearer"}

    # 2. Search for user by email (linking flow)
    user_by_email = db.query(User).filter(User.email == email).first()
    if user_by_email:
        if not user_by_email.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User account is inactive."
            )
            
        # Offer linking if link_confirmed is False
        if not payload.link_confirmed:
            return {
                "status": "link_required",
                "message": f"An account with email {email} already exists. Do you want to link it to your Google account?"
            }
            
        # Link account if link_confirmed is True
        user_by_email.google_id = google_id
        user_by_email.auth_provider = "google"
        user_by_email.avatar = avatar
        user_by_email.email_verified = True
        user_by_email.last_login_at = datetime.now(timezone.utc)
        db.commit()
        access_token = create_access_token(subject=str(user_by_email.id))
        return {"access_token": access_token, "token_type": "bearer"}

    # 3. Create a new user (signup flow)
    new_user = User(
        email=email,
        hashed_password=None, # Google accounts don't use hashed passwords
        full_name=full_name,
        auth_provider="google",
        google_id=google_id,
        avatar=avatar,
        email_verified=True,
        last_login_at=datetime.now(timezone.utc)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(subject=str(new_user.id))
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

