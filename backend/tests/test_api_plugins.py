"""Tests for plugin API routes."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.auth import _token_store, _rate_limiter
from app.api.plugins import set_plugin_manager
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
    """Manually wire the PluginManager so tests don't rely on lifespan."""
    mgr = PluginManager()
    mgr.discover(Path(__file__).resolve().parent.parent / "app" / "plugins")
    set_plugin_manager(mgr)
    yield
    set_plugin_manager(None)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    resp = client.post("/api/auth/login", json={"password": "test-password"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestListPlugins:
    def test_list_plugins(self, client, auth_headers):
        resp = client.get("/api/plugins", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        # At minimum, shell and claude-code should be present
        names = [p["name"] for p in data]
        assert "shell" in names
        assert "claude-code" in names

    def test_plugin_structure(self, client, auth_headers):
        resp = client.get("/api/plugins", headers=auth_headers)
        data = resp.json()
        for plugin in data:
            assert "name" in plugin
            assert "display_name" in plugin
            assert "command" in plugin
            assert "quick_actions" in plugin
            assert "health" in plugin
            assert "available" in plugin["health"]

    def test_unauthenticated(self, client):
        resp = client.get("/api/plugins")
        assert resp.status_code == 401


class TestGetPlugin:
    def test_get_existing(self, client, auth_headers):
        resp = client.get("/api/plugins/shell", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "shell"
        assert data["display_name"] == "Shell"

    def test_get_nonexistent(self, client, auth_headers):
        resp = client.get("/api/plugins/nonexistent", headers=auth_headers)
        assert resp.status_code == 404

    def test_unauthenticated(self, client):
        resp = client.get("/api/plugins/shell")
        assert resp.status_code == 401

    def test_get_plugin_includes_quick_actions(self, client, auth_headers):
        """Plugin detail endpoint should include quick_actions array."""
        resp = client.get("/api/plugins/shell", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "quick_actions" in data
        assert isinstance(data["quick_actions"], list)
        # Shell plugin should have at least Clear and Exit
        labels = [a["label"] for a in data["quick_actions"]]
        assert "Clear" in labels
        assert "Exit" in labels

    def test_quick_action_structure(self, client, auth_headers):
        """Each quick action should have label, command, and icon."""
        resp = client.get("/api/plugins/shell", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        for action in data["quick_actions"]:
            assert "label" in action
            assert "command" in action
            assert "icon" in action


class TestGetPluginHealth:
    def test_health_endpoint(self, client, auth_headers):
        resp = client.get("/api/plugins/shell/health", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["available"] is True

    def test_health_nonexistent(self, client, auth_headers):
        resp = client.get("/api/plugins/nonexistent/health", headers=auth_headers)
        assert resp.status_code == 404

    def test_unauthenticated(self, client):
        resp = client.get("/api/plugins/shell/health")
        assert resp.status_code == 401
