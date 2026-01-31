# backend/tests/test_tunnel.py
import pytest
from unittest.mock import patch, MagicMock
from app.core.tunnel import parse_tunnel_url, TunnelManager, detect_server_port
from app.config import settings


class TestParseTunnelUrl:
    def test_parses_trycloudflare_url(self):
        stderr_output = """
2024-01-30T12:00:00Z INF +---------------------------------------------------+
2024-01-30T12:00:00Z INF |  Your quick tunnel has been created! Visit it at: |
2024-01-30T12:00:00Z INF |  https://random-words-here.trycloudflare.com       |
2024-01-30T12:00:00Z INF +---------------------------------------------------+
"""
        url = parse_tunnel_url(stderr_output)
        assert url == "https://random-words-here.trycloudflare.com"

    def test_returns_none_for_no_url(self):
        stderr_output = "Some random output without a URL"
        url = parse_tunnel_url(stderr_output)
        assert url is None

    def test_handles_multiline_with_noise(self):
        stderr_output = """
2024-01-30T12:00:00Z INF Starting tunnel
2024-01-30T12:00:00Z INF Connecting...
2024-01-30T12:00:00Z INF https://test-abc-123.trycloudflare.com
2024-01-30T12:00:00Z INF Tunnel established
"""
        url = parse_tunnel_url(stderr_output)
        assert url == "https://test-abc-123.trycloudflare.com"


class TestTunnelManager:
    def test_init_state(self):
        manager = TunnelManager()
        assert manager.session_url is None
        assert manager.session_process is None
        assert manager.preview_tunnels == {}
        assert manager.preview_urls == {}

    def test_is_available_true_when_cloudflared_exists(self):
        manager = TunnelManager()
        with patch("shutil.which", return_value="/usr/local/bin/cloudflared"):
            assert manager.is_available() is True

    def test_is_available_false_when_cloudflared_missing(self):
        manager = TunnelManager()
        with patch("shutil.which", return_value=None):
            assert manager.is_available() is False

    @pytest.mark.asyncio
    async def test_start_session_tunnel_success(self):
        manager = TunnelManager()

        mock_process = MagicMock()
        mock_process.stderr.readline = MagicMock(side_effect=[
            b"INF Starting tunnel\n",
            b"INF https://test-session.trycloudflare.com\n",
            b"INF Tunnel ready\n",
        ])
        mock_process.poll = MagicMock(return_value=None)

        with patch("shutil.which", return_value="/usr/local/bin/cloudflared"):
            with patch("subprocess.Popen", return_value=mock_process):
                url = await manager.start_session_tunnel(port=8000)

        assert url == "https://test-session.trycloudflare.com"
        assert manager.session_url == "https://test-session.trycloudflare.com"
        assert manager.session_process is mock_process

    @pytest.mark.asyncio
    async def test_start_session_tunnel_not_available(self):
        manager = TunnelManager()

        with patch("shutil.which", return_value=None):
            url = await manager.start_session_tunnel(port=8000)

        assert url is None
        assert manager.session_url is None

    @pytest.mark.asyncio
    async def test_stop_session_tunnel(self):
        manager = TunnelManager()

        mock_process = MagicMock()
        mock_process.terminate = MagicMock()
        mock_process.wait = MagicMock(return_value=0)
        mock_process.poll = MagicMock(return_value=None)

        manager.session_process = mock_process
        manager.session_url = "https://test.trycloudflare.com"

        await manager.stop_session_tunnel()

        mock_process.terminate.assert_called_once()
        assert manager.session_process is None
        assert manager.session_url is None

    @pytest.mark.asyncio
    async def test_stop_session_tunnel_when_none(self):
        manager = TunnelManager()
        # Should not raise
        await manager.stop_session_tunnel()
        assert manager.session_process is None


class TestTunnelConfig:
    def test_tunnel_enabled_default(self):
        # Default should be True
        assert hasattr(settings, "tunnel_enabled")
        assert settings.tunnel_enabled is True

    def test_tunnel_port_default(self):
        assert hasattr(settings, "tunnel_port")
        assert settings.tunnel_port == 8000


class TestDetectServerPort:
    def test_detect_vite_port(self):
        output = "  VITE v5.0.0  ready in 500 ms\n\n  ➜  Local:   http://localhost:5173/"
        assert detect_server_port(output) == 5173

    def test_detect_next_port(self):
        output = "ready - started server on 0.0.0.0:3000, url: http://localhost:3000"
        assert detect_server_port(output) == 3000

    def test_detect_express_port(self):
        output = "Server listening on port 8080"
        assert detect_server_port(output) == 8080

    def test_detect_python_port(self):
        output = "Uvicorn running on http://127.0.0.1:8080"
        assert detect_server_port(output) == 8080

    def test_no_detection(self):
        output = "Just some random output"
        assert detect_server_port(output) is None

    def test_ignores_common_false_positives(self):
        # Port 8000 is ARC4DE itself, should be ignored
        output = "listening on port 8000"
        assert detect_server_port(output, ignore_ports={8000}) is None
