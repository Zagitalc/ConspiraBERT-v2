"""Compatibility launcher for ConspiraBERT v2.

Use `python app.py` for local development convenience.
The canonical ASGI app lives in `backend/main.py`.
"""

from __future__ import annotations

import os

import uvicorn

from backend.main import app  # noqa: F401


if __name__ == "__main__":
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    reload_enabled = os.getenv("APP_ENV", "development").lower() == "development"
    uvicorn.run("backend.main:app", host=host, port=port, reload=reload_enabled)
