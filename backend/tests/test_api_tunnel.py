"""Tests for tunnel API endpoint."""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


class TestTunnelEndpoint:
    def test_get_tunnel_info(self, client):
        # Mock the tunnel manager
        mock_manager = MagicMock()
        mock_manager.session_url = "https://test.trycloudflare.com"
        mock_manager.preview_urls = {3000: "https://preview.trycloudflare.com"}

        with patch("app.api.tunnel.get_tunnel_manager", return_value=mock_manager):
            response = client.get("/api/tunnel")

        assert response.status_code == 200
        data = response.json()
        assert data["session_url"] == "https://test.trycloudflare.com"
        assert data["previews"] == [{"port": 3000, "url": "https://preview.trycloudflare.com"}]

    def test_get_tunnel_info_no_tunnel(self, client):
        mock_manager = MagicMock()
        mock_manager.session_url = None
        mock_manager.preview_urls = {}

        with patch("app.api.tunnel.get_tunnel_manager", return_value=mock_manager):
            response = client.get("/api/tunnel")

        assert response.status_code == 200
        data = response.json()
        assert data["session_url"] is None
        assert data["previews"] == []

    def test_get_tunnel_info_no_manager(self, client):
        """Test when tunnel manager is not initialized."""
        with patch("app.api.tunnel.get_tunnel_manager", return_value=None):
            response = client.get("/api/tunnel")

        assert response.status_code == 200
        data = response.json()
        assert data["session_url"] is None
        assert data["previews"] == []

    def test_get_tunnel_info_multiple_previews(self, client):
        """Test with multiple preview tunnels."""
        mock_manager = MagicMock()
        mock_manager.session_url = "https://session.trycloudflare.com"
        mock_manager.preview_urls = {
            3000: "https://preview1.trycloudflare.com",
            5173: "https://preview2.trycloudflare.com",
        }

        with patch("app.api.tunnel.get_tunnel_manager", return_value=mock_manager):
            response = client.get("/api/tunnel")

        assert response.status_code == 200
        data = response.json()
        assert data["session_url"] == "https://session.trycloudflare.com"
        assert len(data["previews"]) == 2
        ports = [p["port"] for p in data["previews"]]
        assert 3000 in ports
        assert 5173 in ports
