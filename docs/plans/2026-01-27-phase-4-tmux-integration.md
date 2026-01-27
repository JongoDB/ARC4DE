# Phase 4: tmux Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Python wrapper around tmux that lets the backend create, list, attach to, and kill persistent terminal sessions programmatically.

**Architecture:** An async `TmuxManager` class wraps tmux CLI commands via `asyncio.create_subprocess_exec`. Sessions are named `arc4de-{id}` and tracked with metadata (display name, creation time, state). A background cleanup task kills sessions that have been detached longer than a configurable TTL (default 24h). The sessions API (`/api/sessions`) exposes CRUD operations — all protected by `get_current_user`.

**Tech Stack:** asyncio (subprocess), tmux CLI, FastAPI, pytest (with real tmux in Docker)

---

## Acceptance Criteria

1. `TmuxManager.create_session(name)` creates a tmux session named `arc4de-{id}` and returns session metadata
2. `TmuxManager.list_sessions()` returns all `arc4de-*` sessions with state (active/detached)
3. `TmuxManager.kill_session(session_id)` destroys a tmux session
4. `TmuxManager.session_exists(session_id)` checks if a session is alive
5. `TmuxManager.send_keys(session_id, keys)` sends input to a session
6. `TmuxManager.capture_output(session_id)` captures current pane content
7. Sessions auto-expire after configurable TTL (detached sessions only)
8. `GET /api/sessions` lists sessions (protected)
9. `POST /api/sessions` creates a session (protected)
10. `DELETE /api/sessions/{session_id}` kills a session (protected)
11. All tests pass inside Docker (tmux required)

---

## Task 1: TmuxManager Core — Create, List, Exists, Kill

**Files:**
- Modify: `backend/app/core/tmux.py`
- Create: `backend/tests/test_tmux.py`
- Modify: `backend/app/config.py` (add session TTL setting)
- Modify: `backend/requirements.txt` (add pytest-asyncio)
- Modify: `backend/pyproject.toml` (add asyncio_mode)

**Context:** The `TmuxManager` wraps tmux CLI commands. Each session is named `arc4de-{session_id}` where `session_id` is a short random hex string. The manager filters `tmux list-sessions` to only show arc4de-prefixed sessions, so it won't interfere with any other tmux sessions on the system.

All tmux commands are run via `asyncio.create_subprocess_exec` for non-blocking execution.

**Step 1: Add session config to config.py**

In `backend/app/config.py`, add to the `Settings` class (after `backend_port`):

```python
    # Sessions
    session_ttl_hours: int = 24
```

**Step 2: Add pytest-asyncio dependency**

Add to `backend/requirements.txt`:

```
pytest-asyncio>=0.24.0,<1.0.0
```

Add to `backend/pyproject.toml`:

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

**Step 3: Write failing tests**

Create `backend/tests/test_tmux.py`:

```python
"""Tests for tmux session manager.

These tests require tmux to be installed (run inside Docker).
"""

import asyncio

import pytest

from app.core.tmux import TmuxManager, SessionInfo


@pytest.fixture
def manager():
    return TmuxManager()


@pytest.fixture(autouse=True)
async def cleanup_sessions(manager):
    """Kill any leftover arc4de test sessions after each test."""
    yield
    sessions = await manager.list_sessions()
    for s in sessions:
        try:
            await manager.kill_session(s.session_id)
        except Exception:
            pass


class TestCreateSession:
    @pytest.mark.asyncio
    async def test_creates_session(self, manager):
        info = await manager.create_session("test-create")
        assert info.session_id  # non-empty string
        assert info.name == "test-create"
        assert info.tmux_name.startswith("arc4de-")
        assert info.state in ("active", "detached")

    @pytest.mark.asyncio
    async def test_creates_unique_ids(self, manager):
        info1 = await manager.create_session("session-a")
        info2 = await manager.create_session("session-b")
        assert info1.session_id != info2.session_id


class TestListSessions:
    @pytest.mark.asyncio
    async def test_empty_initially(self, manager):
        sessions = await manager.list_sessions()
        # Filter to only test sessions (other tests might leave some)
        assert isinstance(sessions, list)

    @pytest.mark.asyncio
    async def test_lists_created_sessions(self, manager):
        await manager.create_session("list-test")
        sessions = await manager.list_sessions()
        names = [s.name for s in sessions]
        assert "list-test" in names

    @pytest.mark.asyncio
    async def test_only_arc4de_sessions(self, manager):
        """Should not list non-arc4de tmux sessions."""
        proc = await asyncio.create_subprocess_exec(
            "tmux", "new-session", "-d", "-s", "foreign-session",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.wait()
        try:
            sessions = await manager.list_sessions()
            tmux_names = [s.tmux_name for s in sessions]
            assert "foreign-session" not in tmux_names
        finally:
            proc2 = await asyncio.create_subprocess_exec(
                "tmux", "kill-session", "-t", "foreign-session",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc2.wait()


class TestSessionExists:
    @pytest.mark.asyncio
    async def test_exists_after_create(self, manager):
        info = await manager.create_session("exists-test")
        assert await manager.session_exists(info.session_id) is True

    @pytest.mark.asyncio
    async def test_not_exists_bogus_id(self, manager):
        assert await manager.session_exists("nonexistent") is False


class TestKillSession:
    @pytest.mark.asyncio
    async def test_kill_removes_session(self, manager):
        info = await manager.create_session("kill-test")
        await manager.kill_session(info.session_id)
        assert await manager.session_exists(info.session_id) is False

    @pytest.mark.asyncio
    async def test_kill_nonexistent_raises(self, manager):
        with pytest.raises(ValueError, match="not found"):
            await manager.kill_session("nonexistent")
```

**Step 4: Run tests to verify they fail**

Run: `docker-compose exec backend python -m pytest tests/test_tmux.py -v`
Expected: FAIL

**Step 5: Implement TmuxManager core**

Replace `backend/app/core/tmux.py` with:

```python
"""tmux session management wrapper.

Provides async Python interface to tmux CLI for creating, listing,
and managing persistent terminal sessions.
"""

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.config import settings


@dataclass
class SessionInfo:
    """Metadata about a tmux session."""

    session_id: str
    name: str
    tmux_name: str
    state: str  # "active" | "detached"
    created_at: str  # ISO 8601

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "name": self.name,
            "tmux_name": self.tmux_name,
            "state": self.state,
            "created_at": self.created_at,
        }


# In-memory registry mapping session_id -> display name + created_at.
# tmux itself doesn't store custom metadata, so we track it here.
# Resets on backend restart -- we reconcile with live tmux sessions.
_session_registry: dict[str, dict] = {}


async def _run_tmux(*args: str) -> tuple[int, str, str]:
    """Run a tmux command and return (returncode, stdout, stderr)."""
    proc = await asyncio.create_subprocess_exec(
        "tmux",
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return proc.returncode, stdout.decode().strip(), stderr.decode().strip()


class TmuxManager:
    """Async wrapper around tmux CLI for session management."""

    async def create_session(self, name: str) -> SessionInfo:
        """Create a new tmux session.

        Args:
            name: Display name for the session (e.g., "claude-project").

        Returns:
            SessionInfo with the new session's metadata.

        Raises:
            RuntimeError: If tmux command fails.
        """
        session_id = uuid4().hex[:12]
        tmux_name = f"arc4de-{session_id}"
        now = datetime.now(timezone.utc).isoformat()

        rc, _, stderr = await _run_tmux(
            "new-session", "-d", "-s", tmux_name, "-x", "200", "-y", "50"
        )
        if rc != 0:
            raise RuntimeError(f"Failed to create tmux session: {stderr}")

        _session_registry[session_id] = {"name": name, "created_at": now}

        return SessionInfo(
            session_id=session_id,
            name=name,
            tmux_name=tmux_name,
            state="detached",
            created_at=now,
        )

    async def list_sessions(self) -> list[SessionInfo]:
        """List all arc4de-managed tmux sessions.

        Returns:
            List of SessionInfo for each live arc4de session.
        """
        rc, stdout, _ = await _run_tmux(
            "list-sessions", "-F", "#{session_name}:#{session_attached}"
        )
        if rc != 0 or not stdout:
            return []

        sessions = []
        for line in stdout.splitlines():
            parts = line.split(":")
            if len(parts) < 2:
                continue
            tmux_name, attached = parts[0], parts[1]
            if not tmux_name.startswith("arc4de-"):
                continue

            session_id = tmux_name.removeprefix("arc4de-")
            state = "active" if attached != "0" else "detached"

            # Look up display name from registry, fall back to session_id
            reg = _session_registry.get(session_id, {})
            name = reg.get("name", session_id)
            created_at = reg.get("created_at", "")

            sessions.append(
                SessionInfo(
                    session_id=session_id,
                    name=name,
                    tmux_name=tmux_name,
                    state=state,
                    created_at=created_at,
                )
            )

        return sessions

    async def session_exists(self, session_id: str) -> bool:
        """Check if a tmux session is alive."""
        tmux_name = f"arc4de-{session_id}"
        rc, _, _ = await _run_tmux("has-session", "-t", tmux_name)
        return rc == 0

    async def kill_session(self, session_id: str) -> None:
        """Kill a tmux session.

        Raises:
            ValueError: If session does not exist.
        """
        if not await self.session_exists(session_id):
            raise ValueError(f"Session {session_id} not found")

        tmux_name = f"arc4de-{session_id}"
        rc, _, stderr = await _run_tmux("kill-session", "-t", tmux_name)
        if rc != 0:
            raise RuntimeError(f"Failed to kill session: {stderr}")

        _session_registry.pop(session_id, None)

    async def send_keys(self, session_id: str, keys: str) -> None:
        """Send keystrokes to a tmux session.

        Args:
            session_id: The session to send to.
            keys: The keys/text to send.

        Raises:
            ValueError: If session does not exist.
        """
        if not await self.session_exists(session_id):
            raise ValueError(f"Session {session_id} not found")

        tmux_name = f"arc4de-{session_id}"
        rc, _, stderr = await _run_tmux("send-keys", "-t", tmux_name, keys, "Enter")
        if rc != 0:
            raise RuntimeError(f"Failed to send keys: {stderr}")

    async def capture_output(self, session_id: str, lines: int = 50) -> str:
        """Capture visible pane content from a tmux session.

        Args:
            session_id: The session to capture from.
            lines: Number of lines to capture (default 50).

        Returns:
            The captured text content.

        Raises:
            ValueError: If session does not exist.
        """
        if not await self.session_exists(session_id):
            raise ValueError(f"Session {session_id} not found")

        tmux_name = f"arc4de-{session_id}"
        rc, stdout, stderr = await _run_tmux(
            "capture-pane", "-t", tmux_name, "-p", "-S", f"-{lines}"
        )
        if rc != 0:
            raise RuntimeError(f"Failed to capture output: {stderr}")

        return stdout

    async def cleanup_expired_sessions(
        self, ttl_hours: int | None = None
    ) -> list[str]:
        """Kill sessions that have been alive longer than TTL.

        Args:
            ttl_hours: Override TTL in hours. Defaults to settings.session_ttl_hours.

        Returns:
            List of session_ids that were killed.
        """
        ttl = ttl_hours if ttl_hours is not None else settings.session_ttl_hours
        cutoff = datetime.now(timezone.utc) - timedelta(hours=ttl)
        removed = []

        sessions = await self.list_sessions()
        for session in sessions:
            reg = _session_registry.get(session.session_id, {})
            created_str = reg.get("created_at", "")
            if not created_str:
                continue

            created = datetime.fromisoformat(created_str)
            if created < cutoff:
                try:
                    await self.kill_session(session.session_id)
                    removed.append(session.session_id)
                except Exception:
                    pass

        return removed
```

**Step 6: Run tests to verify they pass**

Run: `docker-compose exec backend python -m pytest tests/test_tmux.py -v`
Expected: All 8 tests PASS

**Step 7: Commit**

```bash
git add backend/app/core/tmux.py backend/app/config.py backend/tests/test_tmux.py backend/requirements.txt backend/pyproject.toml
git commit -m "feat(sessions): add TmuxManager with create/list/exists/kill"
```

---

## Task 2: Send Keys + Capture Output Tests

**Files:**
- Modify: `backend/tests/test_tmux.py` (add tests)

**Context:** `send_keys` and `capture_output` are already implemented in Task 1. This task adds tests for them. We send a command to a session and verify the output is captured.

**Step 1: Add tests to `backend/tests/test_tmux.py`**

Append these test classes:

```python
class TestSendKeys:
    @pytest.mark.asyncio
    async def test_send_keys(self, manager):
        info = await manager.create_session("keys-test")
        await manager.send_keys(info.session_id, "echo hello-arc4de")
        # Give tmux a moment to process
        await asyncio.sleep(0.5)
        output = await manager.capture_output(info.session_id)
        assert "hello-arc4de" in output

    @pytest.mark.asyncio
    async def test_send_keys_nonexistent_raises(self, manager):
        with pytest.raises(ValueError, match="not found"):
            await manager.send_keys("nonexistent", "echo test")


class TestCaptureOutput:
    @pytest.mark.asyncio
    async def test_capture_output(self, manager):
        info = await manager.create_session("capture-test")
        await manager.send_keys(info.session_id, "echo capture-marker-xyz")
        await asyncio.sleep(0.5)
        output = await manager.capture_output(info.session_id)
        assert "capture-marker-xyz" in output

    @pytest.mark.asyncio
    async def test_capture_nonexistent_raises(self, manager):
        with pytest.raises(ValueError, match="not found"):
            await manager.capture_output("nonexistent")
```

**Step 2: Run tests to verify they pass**

Run: `docker-compose exec backend python -m pytest tests/test_tmux.py -v`
Expected: All 12 tests PASS

**Step 3: Commit**

```bash
git add backend/tests/test_tmux.py
git commit -m "test(sessions): add send_keys and capture_output tests"
```

---

## Task 3: Session Cleanup (TTL Expiry)

**Files:**
- Create: `backend/tests/test_tmux_cleanup.py`

**Context:** The `cleanup_expired_sessions` method is already implemented in Task 1. This task adds dedicated tests for it, using backdated `created_at` to simulate old sessions without waiting.

**Step 1: Write tests**

Create `backend/tests/test_tmux_cleanup.py`:

```python
"""Tests for tmux session cleanup."""

import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from app.core.tmux import TmuxManager, _session_registry


@pytest.fixture
def manager():
    return TmuxManager()


@pytest.fixture(autouse=True)
async def cleanup_sessions(manager):
    yield
    sessions = await manager.list_sessions()
    for s in sessions:
        try:
            await manager.kill_session(s.session_id)
        except Exception:
            pass


class TestCleanupExpired:
    @pytest.mark.asyncio
    async def test_removes_expired_session(self, manager):
        info = await manager.create_session("expire-test")
        # Backdate the created_at to simulate an old session
        _session_registry[info.session_id]["created_at"] = (
            datetime.now(timezone.utc) - timedelta(hours=25)
        ).isoformat()

        removed = await manager.cleanup_expired_sessions(ttl_hours=24)
        assert info.session_id in removed
        assert await manager.session_exists(info.session_id) is False

    @pytest.mark.asyncio
    async def test_keeps_fresh_session(self, manager):
        info = await manager.create_session("fresh-test")
        removed = await manager.cleanup_expired_sessions(ttl_hours=24)
        assert info.session_id not in removed
        assert await manager.session_exists(info.session_id) is True

    @pytest.mark.asyncio
    async def test_returns_list_of_removed_ids(self, manager):
        info1 = await manager.create_session("old-1")
        info2 = await manager.create_session("old-2")
        await manager.create_session("new-1")

        # Backdate old sessions
        old_time = (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat()
        _session_registry[info1.session_id]["created_at"] = old_time
        _session_registry[info2.session_id]["created_at"] = old_time

        removed = await manager.cleanup_expired_sessions(ttl_hours=24)
        assert len(removed) == 2
        assert info1.session_id in removed
        assert info2.session_id in removed
```

**Step 2: Run tests to verify they pass**

Run: `docker-compose exec backend python -m pytest tests/test_tmux_cleanup.py -v`
Expected: All 3 tests PASS

**Step 3: Run all tests**

Run: `docker-compose exec backend python -m pytest tests/ -v`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add backend/tests/test_tmux_cleanup.py
git commit -m "test(sessions): add TTL-based session cleanup tests"
```

---

## Task 4: Sessions API Routes

**Files:**
- Modify: `backend/app/api/sessions.py`
- Modify: `backend/app/main.py` (mount sessions router)
- Create: `backend/tests/test_api_sessions.py`

**Context:** REST API for session management. All routes require authentication via `get_current_user`. The `TmuxManager` is instantiated as a module-level singleton in the sessions module.

**Step 1: Write failing tests**

Create `backend/tests/test_api_sessions.py`:

```python
"""Tests for sessions API routes."""

import asyncio

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.auth import _token_store, _rate_limiter
from app.api.sessions import _tmux_manager
from app.core.tmux import _session_registry


@pytest.fixture(autouse=True)
def reset_auth_state():
    _token_store._active_jtis.clear()
    _rate_limiter.reset()
    yield
    _token_store._active_jtis.clear()
    _rate_limiter.reset()


@pytest.fixture(autouse=True)
def cleanup_tmux():
    yield
    # Clean up any tmux sessions created during tests
    loop = asyncio.new_event_loop()
    try:
        sessions = loop.run_until_complete(_tmux_manager.list_sessions())
        for s in sessions:
            try:
                loop.run_until_complete(_tmux_manager.kill_session(s.session_id))
            except Exception:
                pass
    finally:
        loop.close()
    _session_registry.clear()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    resp = client.post("/api/auth/login", json={"password": "test-password"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestCreateSession:
    def test_create(self, client, auth_headers):
        resp = client.post(
            "/api/sessions",
            json={"name": "test-session"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "test-session"
        assert "session_id" in data
        assert data["tmux_name"].startswith("arc4de-")
        assert data["state"] in ("active", "detached")

    def test_create_unauthenticated(self, client):
        resp = client.post("/api/sessions", json={"name": "test"})
        assert resp.status_code == 401


class TestListSessions:
    def test_list_empty(self, client, auth_headers):
        resp = client.get("/api/sessions", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_after_create(self, client, auth_headers):
        client.post(
            "/api/sessions",
            json={"name": "list-test"},
            headers=auth_headers,
        )
        resp = client.get("/api/sessions", headers=auth_headers)
        assert resp.status_code == 200
        names = [s["name"] for s in resp.json()]
        assert "list-test" in names

    def test_list_unauthenticated(self, client):
        resp = client.get("/api/sessions")
        assert resp.status_code == 401


class TestDeleteSession:
    def test_delete(self, client, auth_headers):
        create_resp = client.post(
            "/api/sessions",
            json={"name": "delete-test"},
            headers=auth_headers,
        )
        session_id = create_resp.json()["session_id"]

        resp = client.delete(
            f"/api/sessions/{session_id}", headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

        # Verify it's gone
        list_resp = client.get("/api/sessions", headers=auth_headers)
        ids = [s["session_id"] for s in list_resp.json()]
        assert session_id not in ids

    def test_delete_nonexistent(self, client, auth_headers):
        resp = client.delete(
            "/api/sessions/nonexistent", headers=auth_headers
        )
        assert resp.status_code == 404

    def test_delete_unauthenticated(self, client):
        resp = client.delete("/api/sessions/anything")
        assert resp.status_code == 401
```

**Step 2: Run tests to verify they fail**

Run: `docker-compose exec backend python -m pytest tests/test_api_sessions.py -v`
Expected: FAIL

**Step 3: Implement sessions API**

Replace `backend/app/api/sessions.py` with:

```python
"""Session management API routes (list, create, delete tmux sessions)."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.auth import get_current_user
from app.core.tmux import TmuxManager

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

_tmux_manager = TmuxManager()


class CreateSessionRequest(BaseModel):
    name: str


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_session(
    body: CreateSessionRequest,
    user: dict = Depends(get_current_user),
) -> dict:
    """Create a new tmux session."""
    info = await _tmux_manager.create_session(body.name)
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
```

**Step 4: Mount sessions router in main.py**

In `backend/app/main.py`, add after the auth router import:

```python
from app.api.sessions import router as sessions_router
```

And after `app.include_router(auth_router)`:

```python
app.include_router(sessions_router)
```

**Step 5: Run tests to verify they pass**

Run: `docker-compose exec backend python -m pytest tests/test_api_sessions.py -v`
Expected: All 8 tests PASS

**Step 6: Run all tests**

Run: `docker-compose exec backend python -m pytest tests/ -v`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add backend/app/api/sessions.py backend/app/main.py backend/tests/test_api_sessions.py
git commit -m "feat(sessions): add sessions API routes with auth protection"
```

---

## Task 5: Background Cleanup Task + Docker Verification + CLAUDE.md

**Files:**
- Modify: `backend/app/main.py` (add lifespan for cleanup)
- Modify: `CLAUDE.md`

**Context:** Wire up a background asyncio task that runs `cleanup_expired_sessions` every hour. Uses FastAPI lifespan for clean startup/shutdown.

**Step 1: Update main.py with lifespan**

Replace `backend/app/main.py` with:

```python
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.sessions import router as sessions_router
from app.config import settings
from app.core.tmux import TmuxManager


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


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
```

**Step 2: Rebuild Docker and run all tests**

```bash
docker-compose up -d --build
docker-compose exec backend python -m pytest tests/ -v
```

Expected: All tests PASS

**Step 3: Verify session API via curl**

```bash
# Login
LOGIN=$(curl -s -X POST http://localhost:5175/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"changeme"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Create session
curl -s -X POST http://localhost:5175/api/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-terminal"}'

# List sessions
curl -s http://localhost:5175/api/sessions \
  -H "Authorization: Bearer $TOKEN"

# Delete (use session_id from create response)
```

**Step 4: Update CLAUDE.md**

Update "Current State":
```
Phase: Phase 5 - WebSocket Terminal (NOT STARTED)
Last completed: Phase 4 - tmux Integration (TmuxManager, session CRUD API, TTL cleanup)
```

Update phase tracker:
```
| 4 | tmux Integration - session management wrapper | COMPLETE |
```

**Step 5: Commit**

```bash
git add backend/app/main.py CLAUDE.md
git commit -m "docs: mark Phase 4 tmux integration complete"
```

---

## Summary

| Task | What | Tests | Files |
|------|------|-------|-------|
| 1 | TmuxManager core (create/list/exists/kill + send/capture) | 8 | 5 |
| 2 | Send keys + capture output tests | 4 | 1 |
| 3 | TTL cleanup tests | 3 | 1 |
| 4 | Sessions REST API (/api/sessions) | 8 | 3 |
| 5 | Background cleanup + Docker verification | 0 | 2 |
| **Total** | | **23** | **12** |
