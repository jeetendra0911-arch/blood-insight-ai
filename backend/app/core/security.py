import bcrypt
from datetime import datetime, timedelta, timezone
from jose import jwt

from app.core.config import settings

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    # Hash password using native bcrypt library directly
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    # Verify password using native bcrypt library directly
    try:
        # Check if the hash starts with a scheme indicator (e.g. pbkdf2)
        # and fallback if needed, but the original db hashes are standard bcrypt.
        if hashed.startswith("$pbkdf2-sha256$"):
            # If it's the temporary pbkdf2 hash, handle it or just rely on bcrypt
            # Let's import passlib pbkdf2 here as a fallback
            from passlib.hash import pbkdf2_sha256
            return pbkdf2_sha256.verify(plain, hashed)
            
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception as e:
        print(f"Error verifying password: {e}")
        return False


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": subject, "exp": expire}, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except Exception:
        return None
