"""Tests for WebSocket terminal handler."""

import time

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
