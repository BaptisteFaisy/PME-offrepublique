"""Application settings, loaded from environment / .env via pydantic-settings."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_env: str = "dev"
    log_level: str = "INFO"

    # Persistence
    database_url: str = "postgresql+psycopg://publique:publique@localhost:5432/publique"

    # Queue
    redis_url: str = "redis://localhost:6379/0"

    # Object storage (S3 / MinIO)
    s3_endpoint_url: str = "http://localhost:9000"
    s3_region: str = "fr-par"
    s3_access_key: str = "publique"
    s3_secret_key: str = "publique-secret"
    s3_bucket_dce: str = "publique-dce"

    # LLM (Claude API).
    anthropic_api_key: str = ""
    # The CDC picks Sonnet for classification + structured extraction (cost/quality).
    # Override per environment if a stronger model is justified for accuracy.
    llm_model_classification: str = "claude-sonnet-5"
    llm_model_extraction: str = "claude-sonnet-5"
    # effort tunes token spend on structured-output models (low|medium|high).
    llm_effort: str = "medium"
    llm_max_tokens: int = 8000

    # OCR (Tesseract). A PDF page with fewer than ``ocr_min_chars`` of native
    # text is treated as an image page and re-read via OCR.
    ocr_lang: str = "fra"
    ocr_min_chars: int = 120
    ocr_dpi: int = 300

    # Cap the page-anchored corpus sent to the LLM, to bound cost on 300-page DCE.
    pipeline_max_context_chars: int = 350_000

    # Auth (two internal users, per the CDC). "user:pass,user:pass".
    basic_auth_users: str = "baptiste:changeme,liquid:changeme"

    @property
    def is_dev(self) -> bool:
        return self.app_env == "dev"

    def auth_credentials(self) -> dict[str, str]:
        """Parse BASIC_AUTH_USERS into a {username: password} map."""
        creds: dict[str, str] = {}
        for pair in self.basic_auth_users.split(","):
            pair = pair.strip()
            if not pair or ":" not in pair:
                continue
            user, _, pwd = pair.partition(":")
            creds[user.strip()] = pwd
        return creds


@lru_cache
def get_settings() -> Settings:
    return Settings()
