"""
TechnoFilter — AI-Powered Procurement Corruption Detector
Configuration module
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "TechnoFilter"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_PORT: int = 8000
    SECRET_KEY: str = "technofilter-hackathon-secret-key-2024"

    DATABASE_URL: str = "sqlite+aiosqlite:///./technofilter.db"

    REDIS_URL: Optional[str] = None

    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None

    GOSZAKUP_API_URL: str = "https://ows.goszakup.gov.kz/v3/graphql"
    GOSZAKUP_API_TOKEN: Optional[str] = None

    JWT_SECRET: str = "technofilter-jwt-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
