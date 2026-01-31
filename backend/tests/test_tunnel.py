# backend/tests/test_tunnel.py
import pytest
from app.core.tunnel import parse_tunnel_url


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
