"""Plugin management API routes (list available plugins, health)."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_user

router = APIRouter(prefix="/api/plugins", tags=["plugins"])

# The plugin manager is set during app startup (see main.py).
_plugin_manager = None


def set_plugin_manager(manager) -> None:
    """Called by main.py to inject the initialized PluginManager."""
    global _plugin_manager
    _plugin_manager = manager


def get_plugin_manager():
    """Return the initialized PluginManager (for use by other modules)."""
    return _plugin_manager


def _get_manager():
    if _plugin_manager is None:
        raise RuntimeError("PluginManager not initialized")
    return _plugin_manager


@router.get("")
async def list_plugins(user: dict = Depends(get_current_user)) -> list[dict]:
    """List all registered plugins."""
    mgr = _get_manager()
    return [p.to_dict() for p in mgr.list_all()]


@router.get("/{name}")
async def get_plugin(name: str, user: dict = Depends(get_current_user)) -> dict:
    """Get details for a specific plugin."""
    mgr = _get_manager()
    plugin = mgr.get(name)
    if not plugin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plugin '{name}' not found",
        )
    return plugin.to_dict()


@router.get("/{name}/health")
async def get_plugin_health(
    name: str, user: dict = Depends(get_current_user)
) -> dict:
    """Get health status for a specific plugin."""
    mgr = _get_manager()
    plugin = mgr.get(name)
    if not plugin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plugin '{name}' not found",
        )
    return plugin.get_health().to_dict()
