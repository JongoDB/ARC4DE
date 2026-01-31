"""Cloudflare tunnel management for remote access."""

import asyncio
import logging
import re
import shutil
import subprocess
from subprocess import Popen
from typing import Dict, Optional

logger = logging.getLogger(__name__)

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

    async def start_session_tunnel(self, port: int = 8000) -> Optional[str]:
        """Start the main ARC4DE session tunnel.

        Args:
            port: Local port to tunnel (default 8000)

        Returns:
            The public tunnel URL, or None if unavailable/failed
        """
        if not self.is_available():
            logger.warning("cloudflared not found - tunneling disabled")
            return None

        if self.session_process is not None:
            logger.warning("Session tunnel already running")
            return self.session_url

        try:
            self.session_process = subprocess.Popen(
                ["cloudflared", "tunnel", "--url", f"http://localhost:{port}"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

            # Read stderr lines until we find URL (with timeout)
            url = await self._read_tunnel_url(self.session_process)
            if url:
                self.session_url = url
                logger.info(f"Session tunnel started: {url}")
            else:
                logger.error("Failed to parse tunnel URL")
                await self.stop_session_tunnel()

            return self.session_url

        except Exception as e:
            logger.error(f"Failed to start session tunnel: {e}")
            return None

    async def _read_tunnel_url(
        self, process: Popen, timeout: float = 15.0
    ) -> Optional[str]:
        """Read tunnel URL from cloudflared stderr with timeout."""
        loop = asyncio.get_event_loop()
        collected = ""
        deadline = loop.time() + timeout

        while loop.time() < deadline:
            if process.poll() is not None:
                break

            try:
                line = await asyncio.wait_for(
                    loop.run_in_executor(None, process.stderr.readline),
                    timeout=1.0,
                )
                if line:
                    collected += line.decode("utf-8", errors="replace")
                    url = parse_tunnel_url(collected)
                    if url:
                        return url
            except asyncio.TimeoutError:
                continue

        return parse_tunnel_url(collected)

    async def stop_session_tunnel(self) -> None:
        """Stop the session tunnel."""
        if self.session_process is None:
            return

        try:
            self.session_process.terminate()
            # Wait for graceful shutdown using async executor
            loop = asyncio.get_event_loop()
            try:
                await asyncio.wait_for(
                    loop.run_in_executor(None, self.session_process.wait),
                    timeout=5.0
                )
            except asyncio.TimeoutError:
                self.session_process.kill()
                await loop.run_in_executor(None, self.session_process.wait)
        except Exception as e:
            logger.error(f"Error stopping session tunnel: {e}")
        finally:
            self.session_process = None
            self.session_url = None
            logger.info("Session tunnel stopped")
