"""Cloudflare tunnel management for remote access."""

import re
import shutil
from subprocess import Popen
from typing import Dict, Optional

# Pattern to match trycloudflare.com URLs
TUNNEL_URL_PATTERN = re.compile(r"https://[\w-]+\.trycloudflare\.com")


def parse_tunnel_url(output: str) -> str | None:
    """Extract trycloudflare.com URL from cloudflared output.

    Args:
        output: The stderr output from cloudflared containing tunnel information.

    Returns:
        The extracted tunnel URL, or None if no URL was found.
    """
    match = TUNNEL_URL_PATTERN.search(output)
    return match.group(0) if match else None


class TunnelManager:
    """Manages cloudflared tunnel subprocesses."""

    def __init__(self):
        self.session_process: Optional[Popen] = None
        self.session_url: Optional[str] = None
        self.preview_tunnels: Dict[int, Popen] = {}  # port -> process
        self.preview_urls: Dict[int, str] = {}  # port -> url

    def is_available(self) -> bool:
        """Check if cloudflared binary is available."""
        return shutil.which("cloudflared") is not None
