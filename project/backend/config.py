from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    app_name: str = "ConspiraBERT v2"
    app_version: str = "2.0.0"
    app_env: str = "development"
    default_openai_model: str = "gpt-4.1-mini"
    openai_api_key: str = ""
    openai_model: str = ""
    request_timeout_seconds: float = 25.0

    @property
    def effective_openai_model(self) -> str:
        return self.openai_model.strip() or self.default_openai_model

    @property
    def openai_enabled(self) -> bool:
        return bool(self.openai_api_key.strip())

    @property
    def config_fingerprint(self) -> str:
        payload = "|".join(
            [
                self.app_version,
                self.app_env,
                self.effective_openai_model,
                "openai:on" if self.openai_enabled else "openai:off",
            ]
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]


def get_settings() -> Settings:
    return Settings(
        app_env=os.getenv("APP_ENV", "development"),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        openai_model=os.getenv("OPENAI_MODEL", ""),
    )
