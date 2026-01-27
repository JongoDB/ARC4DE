"""Plugin management API routes (list available plugins, health).

Implemented in Phase 10.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/plugins", tags=["plugins"])
