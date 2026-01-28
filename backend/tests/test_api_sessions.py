"""Tests for sessions API routes."""

import asyncio
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.auth import _token_store, _rate_limiter
from app.api.plugins import set_plugin_manager
from app.api.sessions import _tmux_manager
from app.core.tmux import _session_registry
from app.plugins.manager import PluginManager


@pytest.fixture(autouse=True)
def reset_auth_state():
    _token_store._active_jtis.clear()
    _rate_limiter.reset()
    yield
    _token_store._active_jtis.clear()
    _rate_limiter.reset()


@pytest.fixture(autouse=True)
def _setup_plugin_manager():
    """Wire PluginManager so session creation can resolve plugins."""
    mgr = PluginManager()
    mgr.discover(Path(__file__).resolve().parent.parent / "app" / "plugins")
    set_plugin_manager(mgr)
    yield
    set_plugin_manager(None)


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


class TestCreateSessionWithPlugin:
    def test_create_with_shell_plugin(self, client, auth_headers):
        resp = client.post(
            "/api/sessions",
            json={"name": "shell-test", "plugin": "shell"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "shell-test"
        assert data["plugin"] == "shell"

    def test_create_with_unknown_plugin(self, client, auth_headers):
        resp = client.post(
            "/api/sessions",
            json={"name": "bad", "plugin": "nonexistent"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_create_without_plugin_defaults_to_shell(self, client, auth_headers):
        resp = client.post(
            "/api/sessions",
            json={"name": "default-test"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["plugin"] == "shell"

    def test_plugin_in_session_list(self, client, auth_headers):
        client.post(
            "/api/sessions",
            json={"name": "list-plugin-test", "plugin": "shell"},
            headers=auth_headers,
        )
        resp = client.get("/api/sessions", headers=auth_headers)
        session = next(
            s for s in resp.json() if s["name"] == "list-plugin-test"
        )
        assert session["plugin"] == "shell"
