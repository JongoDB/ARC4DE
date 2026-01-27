import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.sessions import router as sessions_router
from app.config import settings
from app.core.tmux import TmuxManager
from app.ws.terminal import terminal_handler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background cleanup on startup, cancel on shutdown."""
    manager = TmuxManager()
    task = asyncio.create_task(_cleanup_loop(manager))
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


async def _cleanup_loop(manager: TmuxManager) -> None:
    """Periodically clean up expired tmux sessions."""
    while True:
        await asyncio.sleep(3600)  # Every hour
        try:
            removed = await manager.cleanup_expired_sessions()
            if removed:
                print(f"Cleaned up {len(removed)} expired session(s)")
        except Exception:
            pass


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

# WebSocket
app.add_websocket_route("/ws/terminal", terminal_handler)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
