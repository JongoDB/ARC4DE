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
