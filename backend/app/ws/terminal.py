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
