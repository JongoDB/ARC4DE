# Phase 5: WebSocket Terminal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a WebSocket endpoint that bridges browser clients to tmux sessions with real-time terminal I/O, JWT authentication, resize support, and clean reconnection.

**Architecture:** A Starlette WebSocket endpoint at `/ws/terminal` accepts connections, authenticates via a JSON `auth` message containing a JWT, then attaches to a tmux session by spawning `tmux attach-session` with a PTY (via `pty.openpty()` + `asyncio`). Raw terminal bytes flow bidirectionally: client `input` messages write to the PTY, and PTY output streams back as `output` messages. A `ConnectionManager` tracks active connections per session for clean lifecycle management.

**Tech Stack:** FastAPI/Starlette WebSockets, Python `pty` module, asyncio, tmux CLI, JSON message protocol

---

## Acceptance Criteria

1. `WS /ws/terminal` accepts WebSocket connections
2. First message must be `{ "type": "auth", "token": "<jwt>" }` — connection closes with `auth.fail` if invalid
3. After auth, client sends `{ "type": "input", "data": "..." }` — data is written to the PTY
4. Server streams PTY output back as `{ "type": "output", "data": "..." }`
5. `{ "type": "resize", "cols": N, "rows": N }` resizes the tmux pane
6. `{ "type": "ping" }` returns `{ "type": "pong" }`
7. Client can specify `session_id` in auth message to attach to an existing session, or omit to create a new one
8. On WebSocket disconnect, the PTY reader task is cancelled but the tmux session persists
9. Multiple reconnections to the same session work (tmux scrollback provides history)
10. All endpoints protected by JWT validation (reuses `decode_access_token` from `app.core.auth`)
11. All tests pass inside Docker

---

## Task 1: WebSocket Handler — Auth + Ping/Pong

**Files:**
- Modify: `backend/app/ws/terminal.py`
- Modify: `backend/app/main.py` (mount WS route)
- Create: `backend/tests/test_ws_terminal.py`

**Context:** The WebSocket handler accepts connections, waits for an `auth` message with a JWT token, validates it using `decode_access_token`, and responds with `auth.ok` or `auth.fail`. It also handles `ping`/`pong`. No PTY attachment yet — this task just gets the WebSocket lifecycle working.

The Vite dev server already proxies `/ws` to `ws://backend:8000` (see `vite.config.ts`), so WebSocket connections to `ws://localhost:5175/ws/terminal` will be forwarded to the backend.

**Step 1: Write failing tests**

Create `backend/tests/test_ws_terminal.py`:

```python
"""Tests for WebSocket terminal handler."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.auth import _token_store, _rate_limiter


@pytest.fixture(autouse=True)
def reset_auth_state():
    _token_store._active_jtis.clear()
    _rate_limiter.reset()
    yield
    _token_store._active_jtis.clear()
    _rate_limiter.reset()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def access_token(client):
    resp = client.post("/api/auth/login", json={"password": "test-password"})
    return resp.json()["access_token"]


class TestWebSocketAuth:
    def test_auth_ok(self, client, access_token):
        with client.websocket_connect("/ws/terminal") as ws:
            ws.send_json({"type": "auth", "token": access_token})
            msg = ws.receive_json()
            assert msg["type"] == "auth.ok"

    def test_auth_fail_bad_token(self, client):
        with client.websocket_connect("/ws/terminal") as ws:
            ws.send_json({"type": "auth", "token": "invalid-token"})
            msg = ws.receive_json()
            assert msg["type"] == "auth.fail"
            assert "reason" in msg

    def test_auth_fail_missing_token(self, client):
        with client.websocket_connect("/ws/terminal") as ws:
            ws.send_json({"type": "auth"})
            msg = ws.receive_json()
            assert msg["type"] == "auth.fail"

    def test_auth_fail_wrong_message_type(self, client):
        with client.websocket_connect("/ws/terminal") as ws:
            ws.send_json({"type": "input", "data": "ls"})
            msg = ws.receive_json()
            assert msg["type"] == "auth.fail"

    def test_auth_fail_no_token_field(self, client):
        with client.websocket_connect("/ws/terminal") as ws:
            ws.send_json({"type": "auth", "token": ""})
            msg = ws.receive_json()
            assert msg["type"] == "auth.fail"


class TestWebSocketPingPong:
    def test_ping_pong(self, client, access_token):
        with client.websocket_connect("/ws/terminal") as ws:
            ws.send_json({"type": "auth", "token": access_token})
            ws.receive_json()  # auth.ok
            ws.send_json({"type": "ping"})
            msg = ws.receive_json()
            assert msg["type"] == "pong"
```

**Step 2: Run tests to verify they fail**

Run: `docker-compose exec backend python -m pytest tests/test_ws_terminal.py -v`
Expected: FAIL (WebSocket endpoint doesn't exist yet)

**Step 3: Implement WebSocket handler**

Replace `backend/app/ws/terminal.py` with:

```python
"""WebSocket terminal handler - PTY <-> tmux <-> WebSocket bridge.

Handles WebSocket connections at /ws/terminal. Protocol:
1. Client sends: { "type": "auth", "token": "<jwt>" }
2. Server responds: { "type": "auth.ok" } or { "type": "auth.fail", "reason": "..." }
3. After auth, bidirectional messages:
   - Client: { "type": "input", "data": "..." }
   - Client: { "type": "resize", "cols": N, "rows": N }
   - Client: { "type": "ping" }
   - Server: { "type": "output", "data": "..." }
   - Server: { "type": "pong" }
   - Server: { "type": "error", "message": "..." }
"""

import asyncio

from starlette.websockets import WebSocket, WebSocketDisconnect

from app.core.auth import decode_access_token


AUTH_TIMEOUT_SECONDS = 30


async def terminal_handler(websocket: WebSocket) -> None:
    """Main WebSocket handler for terminal connections."""
    await websocket.accept()

    # --- Phase 1: Authentication ---
    try:
        raw = await asyncio.wait_for(
            websocket.receive_json(), timeout=AUTH_TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        await _send(websocket, {"type": "auth.fail", "reason": "Auth timeout"})
        await websocket.close(code=4001)
        return
    except WebSocketDisconnect:
        return

    if raw.get("type") != "auth":
        await _send(websocket, {"type": "auth.fail", "reason": "Expected auth message"})
        await websocket.close(code=4002)
        return

    token = raw.get("token", "")
    if not token:
        await _send(websocket, {"type": "auth.fail", "reason": "Missing token"})
        await websocket.close(code=4003)
        return

    try:
        decode_access_token(token)
    except Exception:
        await _send(websocket, {"type": "auth.fail", "reason": "Invalid or expired token"})
        await websocket.close(code=4004)
        return

    # Auth successful
    session_id = raw.get("session_id")
    await _send(websocket, {"type": "auth.ok"})

    # --- Phase 2: Message loop ---
    try:
        await _message_loop(websocket, session_id)
    except WebSocketDisconnect:
        pass


async def _message_loop(websocket: WebSocket, session_id: str | None) -> None:
    """Process messages after authentication."""
    while True:
        try:
            msg = await websocket.receive_json()
        except WebSocketDisconnect:
            return

        msg_type = msg.get("type")

        if msg_type == "ping":
            await _send(websocket, {"type": "pong"})

        elif msg_type == "input":
            # PTY input handling - implemented in Task 2
            pass

        elif msg_type == "resize":
            # PTY resize handling - implemented in Task 2
            pass

        else:
            await _send(websocket, {
                "type": "error",
                "message": f"Unknown message type: {msg_type}",
            })


async def _send(websocket: WebSocket, data: dict) -> None:
    """Send a JSON message to the client, ignoring errors on closed connections."""
    try:
        await websocket.send_json(data)
    except Exception:
        pass
```

**Step 4: Mount WebSocket route in main.py**

In `backend/app/main.py`, add after the existing imports:

```python
from app.ws.terminal import terminal_handler
```

Add after `app.include_router(sessions_router)`:

```python
# WebSocket
app.add_websocket_route("/ws/terminal", terminal_handler)
```

**Step 5: Run tests to verify they pass**

Run: `docker-compose exec backend python -m pytest tests/test_ws_terminal.py -v`
Expected: All 6 tests PASS

**Step 6: Run all tests**

Run: `docker-compose exec backend python -m pytest tests/ -v`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add backend/app/ws/terminal.py backend/app/main.py backend/tests/test_ws_terminal.py
git commit -m "feat(ws): add WebSocket endpoint with JWT auth and ping/pong"
```

---

## Task 2: PTY Bridge — Attach to tmux + Stream Output

**Files:**
- Modify: `backend/app/ws/terminal.py`
- Modify: `backend/tests/test_ws_terminal.py` (add tests)

**Context:** After authentication, the handler creates (or attaches to) a tmux session via a PTY. We use Python's `pty.openpty()` to create a pseudo-terminal pair, then spawn `tmux attach-session -t <name>` with the slave end as stdin/stdout/stderr. An asyncio reader task reads from the master end and sends `output` messages to the client. Client `input` messages write to the master end.

This gives us a real terminal — cursor positioning, colors, interactive programs (vim, htop) all work because tmux provides full terminal emulation.

**Step 1: Add tests**

Append to `backend/tests/test_ws_terminal.py`:

```python
import asyncio
import time

from app.api.sessions import _tmux_manager
from app.core.tmux import _session_registry


@pytest.fixture(autouse=True)
def cleanup_tmux():
    yield
    # Clean up any tmux sessions created during tests
    import asyncio as _asyncio
    loop = _asyncio.new_event_loop()
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


class TestWebSocketTerminalIO:
    def test_input_produces_output(self, client, access_token):
        """Send a command and verify we get output back."""
        # First create a session
        resp = client.post(
            "/api/sessions",
            json={"name": "ws-test"},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        session_id = resp.json()["session_id"]

        with client.websocket_connect("/ws/terminal") as ws:
            ws.send_json({
                "type": "auth",
                "token": access_token,
                "session_id": session_id,
            })
            auth_msg = ws.receive_json()
            assert auth_msg["type"] == "auth.ok"

            # Send a command
            ws.send_json({"type": "input", "data": "echo ws-test-marker\n"})

            # Collect output until we see the marker
            output = ""
            deadline = time.time() + 5  # 5 second timeout
            while time.time() < deadline:
                try:
                    msg = ws.receive_json()
                    if msg["type"] == "output":
                        output += msg["data"]
                        if "ws-test-marker" in output:
                            break
                except Exception:
                    break

            assert "ws-test-marker" in output

    def test_new_session_created_if_no_session_id(self, client, access_token):
        """If no session_id is provided, a new session should be created."""
        with client.websocket_connect("/ws/terminal") as ws:
            ws.send_json({"type": "auth", "token": access_token})
            auth_msg = ws.receive_json()
            assert auth_msg["type"] == "auth.ok"
            # Should get some initial output (shell prompt)
            msg = ws.receive_json()
            assert msg["type"] == "output"

    def test_attach_to_existing_session(self, client, access_token):
        """Can attach to a pre-existing session."""
        resp = client.post(
            "/api/sessions",
            json={"name": "existing"},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        session_id = resp.json()["session_id"]

        with client.websocket_connect("/ws/terminal") as ws:
            ws.send_json({
                "type": "auth",
                "token": access_token,
                "session_id": session_id,
            })
            auth_msg = ws.receive_json()
            assert auth_msg["type"] == "auth.ok"

    def test_invalid_session_id_returns_error(self, client, access_token):
        """Attaching to a nonexistent session should return an error."""
        with client.websocket_connect("/ws/terminal") as ws:
            ws.send_json({
                "type": "auth",
                "token": access_token,
                "session_id": "nonexistent-id",
            })
            msg = ws.receive_json()
            assert msg["type"] == "error"
```

**Step 2: Run tests to verify they fail**

Run: `docker-compose exec backend python -m pytest tests/test_ws_terminal.py::TestWebSocketTerminalIO -v`
Expected: FAIL (input/output not implemented)

**Step 3: Implement PTY bridge**

Replace `backend/app/ws/terminal.py` with the full implementation:

```python
"""WebSocket terminal handler - PTY <-> tmux <-> WebSocket bridge.

Handles WebSocket connections at /ws/terminal. Protocol:
1. Client sends: { "type": "auth", "token": "<jwt>", "session_id?": "..." }
2. Server responds: { "type": "auth.ok" } or { "type": "auth.fail", "reason": "..." }
3. After auth, bidirectional messages:
   - Client -> Server: { "type": "input", "data": "..." }
   - Client -> Server: { "type": "resize", "cols": N, "rows": N }
   - Client -> Server: { "type": "ping" }
   - Server -> Client: { "type": "output", "data": "..." }
   - Server -> Client: { "type": "pong" }
   - Server -> Client: { "type": "error", "message": "..." }
"""

import asyncio
import fcntl
import os
import pty
import struct
import termios

from starlette.websockets import WebSocket, WebSocketDisconnect

from app.core.auth import decode_access_token
from app.core.tmux import TmuxManager


AUTH_TIMEOUT_SECONDS = 30
READ_SIZE = 4096

_tmux_manager = TmuxManager()


async def terminal_handler(websocket: WebSocket) -> None:
    """Main WebSocket handler for terminal connections."""
    await websocket.accept()

    # --- Phase 1: Authentication ---
    try:
        raw = await asyncio.wait_for(
            websocket.receive_json(), timeout=AUTH_TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        await _send(websocket, {"type": "auth.fail", "reason": "Auth timeout"})
        await websocket.close(code=4001)
        return
    except WebSocketDisconnect:
        return

    if raw.get("type") != "auth":
        await _send(websocket, {"type": "auth.fail", "reason": "Expected auth message"})
        await websocket.close(code=4002)
        return

    token = raw.get("token", "")
    if not token:
        await _send(websocket, {"type": "auth.fail", "reason": "Missing token"})
        await websocket.close(code=4003)
        return

    try:
        decode_access_token(token)
    except Exception:
        await _send(websocket, {"type": "auth.fail", "reason": "Invalid or expired token"})
        await websocket.close(code=4004)
        return

    # --- Phase 2: Attach to tmux session ---
    session_id = raw.get("session_id")

    if session_id:
        # Verify the session exists
        if not await _tmux_manager.session_exists(session_id):
            await _send(websocket, {"type": "error", "message": f"Session {session_id} not found"})
            await websocket.close(code=4005)
            return
    else:
        # Create a new session
        info = await _tmux_manager.create_session("terminal")
        session_id = info.session_id

    tmux_name = f"arc4de-{session_id}"

    # Open a PTY pair
    master_fd, slave_fd = pty.openpty()

    # Spawn tmux attach with the slave end as the terminal
    proc = await asyncio.create_subprocess_exec(
        "tmux", "attach-session", "-t", tmux_name,
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
    )
    os.close(slave_fd)  # Parent doesn't need the slave end

    # Set master fd to non-blocking
    flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    await _send(websocket, {"type": "auth.ok"})

    # --- Phase 3: Bidirectional I/O ---
    reader_task = asyncio.create_task(_pty_reader(master_fd, websocket))

    try:
        await _message_loop(websocket, master_fd, tmux_name)
    except WebSocketDisconnect:
        pass
    finally:
        reader_task.cancel()
        try:
            await reader_task
        except asyncio.CancelledError:
            pass
        os.close(master_fd)
        proc.kill()
        await proc.wait()


async def _pty_reader(master_fd: int, websocket: WebSocket) -> None:
    """Read from PTY master and send output to WebSocket."""
    loop = asyncio.get_event_loop()
    try:
        while True:
            try:
                data = await loop.run_in_executor(
                    None, _blocking_read, master_fd
                )
                if not data:
                    break
                await websocket.send_json({
                    "type": "output",
                    "data": data.decode("utf-8", errors="replace"),
                })
            except OSError:
                break
    except asyncio.CancelledError:
        pass
    except Exception:
        pass


def _blocking_read(fd: int) -> bytes:
    """Blocking read from a file descriptor. Runs in executor."""
    # Reset to blocking mode for this read
    flags = fcntl.fcntl(fd, fcntl.F_GETFL)
    fcntl.fcntl(fd, fcntl.F_SETFL, flags & ~os.O_NONBLOCK)
    try:
        return os.read(fd, READ_SIZE)
    except OSError:
        return b""
    finally:
        fcntl.fcntl(fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)


async def _message_loop(
    websocket: WebSocket, master_fd: int, tmux_name: str
) -> None:
    """Process client messages after authentication."""
    while True:
        try:
            msg = await websocket.receive_json()
        except WebSocketDisconnect:
            return

        msg_type = msg.get("type")

        if msg_type == "ping":
            await _send(websocket, {"type": "pong"})

        elif msg_type == "input":
            data = msg.get("data", "")
            if data:
                os.write(master_fd, data.encode("utf-8"))

        elif msg_type == "resize":
            cols = msg.get("cols", 80)
            rows = msg.get("rows", 24)
            _resize_pty(master_fd, rows, cols)
            # Also resize the tmux window
            await _resize_tmux(tmux_name, cols, rows)

        else:
            await _send(websocket, {
                "type": "error",
                "message": f"Unknown message type: {msg_type}",
            })


def _resize_pty(fd: int, rows: int, cols: int) -> None:
    """Resize the PTY window."""
    try:
        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
    except Exception:
        pass


async def _resize_tmux(tmux_name: str, cols: int, rows: int) -> None:
    """Resize the tmux session's window."""
    proc = await asyncio.create_subprocess_exec(
        "tmux", "resize-window", "-t", tmux_name, "-x", str(cols), "-y", str(rows),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await proc.wait()


async def _send(websocket: WebSocket, data: dict) -> None:
    """Send a JSON message to the client, ignoring errors on closed connections."""
    try:
        await websocket.send_json(data)
    except Exception:
        pass
```

**Step 4: Run tests to verify they pass**

Run: `docker-compose exec backend python -m pytest tests/test_ws_terminal.py -v`
Expected: All 10 tests PASS

**Step 5: Run all tests**

Run: `docker-compose exec backend python -m pytest tests/ -v`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add backend/app/ws/terminal.py backend/tests/test_ws_terminal.py
git commit -m "feat(ws): add PTY bridge for tmux session I/O over WebSocket"
```

---

## Task 3: Terminal Resize Support Tests

**Files:**
- Modify: `backend/tests/test_ws_terminal.py` (add resize tests)

**Context:** Resize is already implemented in Task 2. This task adds dedicated tests for the resize message handling.

**Step 1: Add tests**

Append to `backend/tests/test_ws_terminal.py`:

```python
class TestWebSocketResize:
    def test_resize(self, client, access_token):
        """Resize message should not error."""
        resp = client.post(
            "/api/sessions",
            json={"name": "resize-test"},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        session_id = resp.json()["session_id"]

        with client.websocket_connect("/ws/terminal") as ws:
            ws.send_json({
                "type": "auth",
                "token": access_token,
                "session_id": session_id,
            })
            ws.receive_json()  # auth.ok
            ws.send_json({"type": "resize", "cols": 120, "rows": 40})
            # Send a ping to verify connection is still alive after resize
            ws.send_json({"type": "ping"})
            msg = ws.receive_json()
            assert msg["type"] in ("pong", "output")

    def test_unknown_message_type(self, client, access_token):
        """Unknown message types should return an error message."""
        with client.websocket_connect("/ws/terminal") as ws:
            ws.send_json({"type": "auth", "token": access_token})
            ws.receive_json()  # auth.ok
            ws.send_json({"type": "unknown_type"})
            # Drain any output messages first, then look for error
            deadline = time.time() + 3
            found_error = False
            while time.time() < deadline:
                try:
                    msg = ws.receive_json()
                    if msg["type"] == "error":
                        assert "unknown_type" in msg["message"].lower() or "Unknown" in msg["message"]
                        found_error = True
                        break
                except Exception:
                    break
            assert found_error
```

**Step 2: Run tests to verify they pass**

Run: `docker-compose exec backend python -m pytest tests/test_ws_terminal.py -v`
Expected: All 12 tests PASS

**Step 3: Commit**

```bash
git add backend/tests/test_ws_terminal.py
git commit -m "test(ws): add resize and unknown message type tests"
```

---

## Task 4: Integration Test — Full Round-Trip + CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Context:** This task verifies the full WebSocket flow works end-to-end through the Vite proxy. We rebuild Docker, run all tests, verify via a Python WebSocket client inside the container, and update CLAUDE.md.

**Step 1: Rebuild Docker**

```bash
docker-compose up -d --build
```

**Step 2: Run all tests inside Docker**

```bash
docker-compose exec backend python -m pytest tests/ -v
```

Expected: All tests PASS

**Step 3: Verify via curl + Python WebSocket client**

Login and create a session:
```bash
LOGIN=$(curl -s -X POST http://localhost:5175/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"changeme"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

SESSION=$(curl -s -X POST http://localhost:5175/api/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"ws-verify"}')
SESSION_ID=$(echo "$SESSION" | python3 -c "import sys,json; print(json.load(sys.stdin)['session_id'])")

echo "Token: $TOKEN"
echo "Session ID: $SESSION_ID"
```

Then test WebSocket from inside the Docker container using the `websockets` library (already in requirements.txt):

```bash
docker-compose exec backend python3 << 'PYEOF'
import asyncio, json, websockets, os

TOKEN = os.environ.get("TEST_TOKEN", "")
SESSION_ID = os.environ.get("TEST_SESSION_ID", "")

# Read from env or use inline values
async def test():
    async with websockets.connect('ws://localhost:8000/ws/terminal') as ws:
        await ws.send(json.dumps({'type': 'auth', 'token': TOKEN, 'session_id': SESSION_ID}))
        msg = json.loads(await ws.recv())
        print(f'Auth: {msg}')
        assert msg['type'] == 'auth.ok'

        await ws.send(json.dumps({'type': 'input', 'data': 'echo HELLO_WS_TEST\n'}))
        output = ''
        for _ in range(20):
            try:
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=1.0))
                if msg['type'] == 'output':
                    output += msg['data']
                    if 'HELLO_WS_TEST' in output:
                        break
            except asyncio.TimeoutError:
                break
        print(f'Output contains marker: {"HELLO_WS_TEST" in output}')
        assert 'HELLO_WS_TEST' in output

        await ws.send(json.dumps({'type': 'ping'}))
        msg = json.loads(await ws.recv())
        print(f'Ping: {msg}')
        assert msg['type'] == 'pong'

        print('ALL WEBSOCKET TESTS PASSED')

asyncio.run(test())
PYEOF
```

**Step 4: Update CLAUDE.md**

Change current state:
```
**Phase:** Phase 6 - Frontend Shell (NOT STARTED)
```
```
**Last completed:** Phase 5 - WebSocket Terminal (PTY bridge, auth, resize, I/O streaming)
```

Update phase tracker:
```
| 5 | WebSocket Terminal - PTY/tmux/WS bridge | COMPLETE |
```

**Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark Phase 5 WebSocket terminal complete"
```

---

## Summary

| Task | What | Tests | Files |
|------|------|-------|-------|
| 1 | WebSocket handler — auth + ping/pong | 6 | 3 |
| 2 | PTY bridge — tmux attach + I/O streaming | 4 | 2 |
| 3 | Resize support tests | 2 | 1 |
| 4 | Integration verification + CLAUDE.md | 0 | 1 |
| **Total** | | **12** | **7** |
