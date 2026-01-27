"""Session management API routes (list, create, delete tmux sessions).

Implemented in Phase 4.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/sessions", tags=["sessions"])
