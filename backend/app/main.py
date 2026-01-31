import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.plugins import router as plugins_router, set_plugin_manager
from app.api.sessions import router as sessions_router
from app.api.tunnel import router as tunnel_router, set_tunnel_manager
from app.config import settings
from app.core.tmux import TmuxManager
from app.core.tunnel import TunnelManager
from app.plugins.manager import PluginManager
from app.ws.terminal import terminal_handler

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background cleanup, plugins, and tunnel on startup."""
    # Plugin discovery
    plugin_mgr = PluginManager()
    plugin_mgr.discover(Path(__file__).resolve().parent / "plugins")
    await plugin_mgr.initialize_all()
    set_plugin_manager(plugin_mgr)

    # Tunnel manager
    tunnel_mgr = TunnelManager()
    set_tunnel_manager(tunnel_mgr)

    # Start session tunnel if enabled
    if settings.tunnel_enabled:
        try:
            await tunnel_mgr.start_session_tunnel(
                port=settings.tunnel_port,
                host=settings.tunnel_host,
            )
        except Exception as e:
            logger.error(f"Failed to start tunnel during startup: {e}")
            # Continue with app startup even if tunnel fails

    # Session cleanup loop
    manager = TmuxManager()
    task = asyncio.create_task(_cleanup_loop(manager))

    yield

    # Shutdown
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    # Stop tunnel
    try:
        await tunnel_mgr.stop_session_tunnel()
    except Exception as e:
        logger.error(f"Error during tunnel shutdown: {e}")


async def _cleanup_loop(manager: TmuxManager) -> None:
    """Periodically clean up expired tmux sessions."""
    while True:
        await asyncio.sleep(3600)  # Every hour
        try:
            removed = await manager.cleanup_expired_sessions()
            if removed:
                logger.info(f"Cleaned up {len(removed)} expired session(s)")
        except Exception as e:
            logger.error(f"Error during session cleanup: {e}")


app = FastAPI(
    title="ARC4DE",
    description="Automated Remote Control for Distributed Environments",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth_router)
app.include_router(sessions_router)
app.include_router(plugins_router)
app.include_router(tunnel_router)

# WebSocket
app.add_websocket_route("/ws/terminal", terminal_handler)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
