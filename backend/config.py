import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgrespassword@localhost:5432/photomanager"
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Google Photos OAuth (Optional)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/callback"
    
    # Local Storage scanning directory
    LOCAL_PHOTOS_DIR: str = "/photos"
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
