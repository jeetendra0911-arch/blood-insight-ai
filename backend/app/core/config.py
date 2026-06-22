from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/blood_analyzer"
    SECRET_KEY: str = "change-me"
    GOOGLE_API_KEY: str = ""
    UPLOAD_DIR: str = "uploads"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
