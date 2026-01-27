"""Tests for protected route dependency."""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import create_token_pair
from app.api.auth import _token_store, _rate_limiter


@pytest.fixture(autouse=True)
def reset_state():
    _token_store._active_jtis.clear()
    _rate_limiter.reset()
    yield
    _token_store._active_jtis.clear()
    _rate_limiter.reset()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_tokens(client):
    resp = client.post("/api/auth/login", json={"password": "test-password"})
    return resp.json()


class TestProtectedEndpoint:
    def test_with_valid_token(self, client, auth_tokens):
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {auth_tokens['access_token']}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["sub"] == "owner"
        assert data["type"] == "access"

    def test_without_token(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_with_invalid_token(self, client):
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert resp.status_code == 401

    def test_with_expired_token(self, client):
        pair = create_token_pair(access_expiry_override=timedelta(seconds=-1))
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {pair.access_token}"},
        )
        assert resp.status_code == 401

    def test_with_refresh_token_as_access(self, client, auth_tokens):
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {auth_tokens['refresh_token']}"},
        )
        assert resp.status_code == 401

    def test_malformed_header(self, client):
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": "NotBearer token"},
        )
        assert resp.status_code == 401

    def test_bearer_no_token(self, client):
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer "},
        )
        assert resp.status_code == 401
