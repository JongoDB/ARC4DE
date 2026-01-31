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
from app.core.tunnel import detect_server_port
from app.api.tunnel import get_tunnel_manager


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
    env = os.environ.copy()
    env.setdefault("TERM", "xterm-256color")
    proc = await asyncio.create_subprocess_exec(
        "tmux", "attach-session", "-t", tmux_name,
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        env=env,
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
        try:
            os.close(master_fd)
        except OSError:
            pass
        try:
            proc.kill()
        except ProcessLookupError:
            pass
        await proc.wait()


async def _pty_reader(master_fd: int, websocket: WebSocket) -> None:
    """Read from PTY master and send output to WebSocket."""
    loop = asyncio.get_event_loop()
    tunnel_manager = get_tunnel_manager()
    recent_output = ""  # Buffer for port detection

    try:
        while True:
            try:
                data = await loop.run_in_executor(
                    None, _blocking_read, master_fd
                )
                if not data:
                    break

                text = data.decode("utf-8", errors="replace")

                # Scan for dev server ports
                if tunnel_manager:
                    recent_output += text
                    # Keep only last 1KB for scanning
                    recent_output = recent_output[-1024:]

                    port = detect_server_port(recent_output)
                    if port and port not in tunnel_manager.preview_urls:
                        # Start preview tunnel in background
                        asyncio.create_task(
                            _start_preview_and_notify(tunnel_manager, port, websocket)
                        )

                await websocket.send_json({
                    "type": "output",
                    "data": text,
                })
            except OSError:
                break
    except asyncio.CancelledError:
        pass
    except Exception:
        pass


async def _start_preview_and_notify(tunnel_manager, port: int, websocket: WebSocket) -> None:
    """Start a preview tunnel and notify the client."""
    try:
        url = await tunnel_manager.start_preview_tunnel(port)
        if url:
            await _send(websocket, {
                "type": "tunnel.preview",
                "port": port,
                "url": url,
            })
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
