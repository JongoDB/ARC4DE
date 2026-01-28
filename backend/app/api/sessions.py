"""Session management API routes (list, create, delete tmux sessions)."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.auth import get_current_user
from app.api.plugins import get_plugin_manager
from app.core.tmux import TmuxManager

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

_tmux_manager = TmuxManager()


class CreateSessionRequest(BaseModel):
    name: str
    plugin: str = "shell"


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_session(
    body: CreateSessionRequest,
    user: dict = Depends(get_current_user),
) -> dict:
    """Create a new tmux session."""
    mgr = get_plugin_manager()
    if mgr is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PluginManager not initialized",
        )

    plugin = mgr.get(body.plugin)
    if plugin is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plugin '{body.plugin}' not found",
        )

    info = await _tmux_manager.create_session(
        name=body.name,
        command=plugin.command,
        plugin=body.plugin,
    )
    return info.to_dict()


@router.get("")
async def list_sessions(
    user: dict = Depends(get_current_user),
) -> list[dict]:
    """List all active tmux sessions."""
    sessions = await _tmux_manager.list_sessions()
    return [s.to_dict() for s in sessions]


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    user: dict = Depends(get_current_user),
) -> dict:
    """Kill a tmux session."""
    try:
        await _tmux_manager.kill_session(session_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )
    return {"status": "ok"}
