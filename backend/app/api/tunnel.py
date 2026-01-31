"""Tunnel information API endpoint."""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter
from pydantic import BaseModel

if TYPE_CHECKING:
    from app.core.tunnel import TunnelManager

router = APIRouter(prefix="/api", tags=["tunnel"])

# Global tunnel manager reference (set by main.py)
_tunnel_manager: TunnelManager | None = None


def set_tunnel_manager(manager: TunnelManager | None) -> None:
    """Set the global tunnel manager reference."""
    global _tunnel_manager
    _tunnel_manager = manager


def get_tunnel_manager() -> TunnelManager | None:
    """Get the global tunnel manager."""
    return _tunnel_manager


class PreviewInfo(BaseModel):
    port: int
    url: str


class TunnelInfo(BaseModel):
    session_url: str | None
    previews: list[PreviewInfo]


@router.get("/tunnel", response_model=TunnelInfo)
async def get_tunnel_info() -> TunnelInfo:
    """Get current tunnel URLs."""
    manager = get_tunnel_manager()

    if manager is None:
        return TunnelInfo(session_url=None, previews=[])

    previews = [
        PreviewInfo(port=port, url=url)
        for port, url in manager.preview_urls.items()
    ]

    return TunnelInfo(
        session_url=manager.session_url,
        previews=previews,
    )
