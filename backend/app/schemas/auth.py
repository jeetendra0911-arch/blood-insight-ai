from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str | None = None
    dob: datetime | None = None
    gender: str | None = None
    role: str = "PATIENT"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: int | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str | None = None
    role: str
    dob: datetime | None = None
    gender: str | None = None
    is_active: bool
    created_at: datetime
    auth_provider: str
    avatar: str | None = None
    email_verified: bool
    last_login_at: datetime | None = None


class GoogleLogin(BaseModel):
    token: str
    link_confirmed: bool = False
