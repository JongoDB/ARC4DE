"""Tests for auth API routes."""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import create_token_pair, decode_refresh_token
from app.api.auth import _token_store, _rate_limiter


@pytest.fixture(autouse=True)
def reset_state():
    """Reset token store and rate limiter between tests."""
    _token_store._active_jtis.clear()
    _rate_limiter.reset()
    yield
    _token_store._active_jtis.clear()
    _rate_limiter.reset()


@pytest.fixture
def client():
    return TestClient(app)


class TestLogin:
    def test_success(self, client):
        resp = client.post("/api/auth/login", json={"password": "test-password"})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_wrong_password(self, client):
        resp = client.post("/api/auth/login", json={"password": "wrong"})
        assert resp.status_code == 401
        assert "Invalid" in resp.json()["detail"]

    def test_missing_password(self, client):
        resp = client.post("/api/auth/login", json={})
        assert resp.status_code == 422

    def test_rate_limit(self, client):
        for _ in range(5):
            client.post("/api/auth/login", json={"password": "wrong"})
        resp = client.post("/api/auth/login", json={"password": "test-password"})
        assert resp.status_code == 429
        assert "locked" in resp.json()["detail"].lower()


class TestRefresh:
    def test_success(self, client):
        login_resp = client.post("/api/auth/login", json={"password": "test-password"})
        refresh_token = login_resp.json()["refresh_token"]

        resp = client.post(
            "/api/auth/refresh", json={"refresh_token": refresh_token}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["refresh_token"] != refresh_token

    def test_reuse_rotated_token(self, client):
        login_resp = client.post("/api/auth/login", json={"password": "test-password"})
        old_refresh = login_resp.json()["refresh_token"]

        client.post("/api/auth/refresh", json={"refresh_token": old_refresh})

        resp = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
        assert resp.status_code == 401

    def test_invalid_token(self, client):
        resp = client.post(
            "/api/auth/refresh", json={"refresh_token": "not.valid.token"}
        )
        assert resp.status_code == 401

    def test_access_token_rejected(self, client):
        login_resp = client.post("/api/auth/login", json={"password": "test-password"})
        access_token = login_resp.json()["access_token"]
        resp = client.post(
            "/api/auth/refresh", json={"refresh_token": access_token}
        )
        assert resp.status_code == 401


class TestLogout:
    def test_success(self, client):
        login_resp = client.post("/api/auth/login", json={"password": "test-password"})
        tokens = login_resp.json()
        access = tokens["access_token"]
        refresh = tokens["refresh_token"]

        resp = client.post(
            "/api/auth/logout",
            json={"refresh_token": refresh},
            headers={"Authorization": f"Bearer {access}"},
        )
        assert resp.status_code == 200

        resp = client.post(
            "/api/auth/refresh", json={"refresh_token": refresh}
        )
        assert resp.status_code == 401

    def test_unauthenticated(self, client):
        resp = client.post(
            "/api/auth/logout", json={"refresh_token": "something"}
        )
        assert resp.status_code == 401


class TestHealthUnprotected:
    def test_health_no_auth(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}
