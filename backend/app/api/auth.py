"""Authentication API routes (login, refresh, pair, logout).

Implemented in Phase 3.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/auth", tags=["auth"])
