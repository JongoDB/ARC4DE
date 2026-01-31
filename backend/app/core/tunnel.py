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

# Patterns to detect dev server ports from terminal output
PREVIEW_PATTERNS = [
    re.compile(r"listening on (?:port )?(\d+)", re.IGNORECASE),
    re.compile(r"Local:\s+https?://(?:localhost|127\.0\.0\.1):(\d+)"),
    re.compile(r"ready on https?://(?:localhost|127\.0\.0\.1):(\d+)"),
    re.compile(r"started server on.*:(\d+)"),
    re.compile(r"Server (?:running|listening) (?:on|at) https?://(?:localhost|127\.0\.0\.1):(\d+)", re.IGNORECASE),
    re.compile(r"running on https?://(?:localhost|127\.0\.0\.1):(\d+)", re.IGNORECASE),
]

DEFAULT_IGNORE_PORTS = {8000}  # ARC4DE backend


def detect_server_port(output: str, ignore_ports: set[int] | None = None) -> int | None:
    """Detect a dev server port from terminal output.

    Args:
        output: Terminal output text to scan for server port patterns.
        ignore_ports: Set of ports to ignore (e.g., ARC4DE's own port).
                     Defaults to {8000}.

    Returns:
        The detected port number, or None if no port was found.
    """
    if ignore_ports is None:
        ignore_ports = DEFAULT_IGNORE_PORTS

    for pattern in PREVIEW_PATTERNS:
        match = pattern.search(output)
        if match:
            port = int(match.group(1))
            if port not in ignore_ports:
                return port
    return None


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

    async def start_preview_tunnel(self, port: int) -> Optional[str]:
        """Start a tunnel for a dev server preview.

        Args:
            port: Local port to tunnel

        Returns:
            The public tunnel URL, or None if unavailable/failed
        """
        if not self.is_available():
            return None

        if port in self.preview_tunnels:
            return self.preview_urls.get(port)

        try:
            process = subprocess.Popen(
                ["cloudflared", "tunnel", "--url", f"http://localhost:{port}"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

            url = await self._read_tunnel_url(process)
            if url:
                self.preview_tunnels[port] = process
                self.preview_urls[port] = url
                logger.info(f"Preview tunnel started for port {port}: {url}")
                return url
            else:
                process.terminate()
                process.wait()
                return None

        except Exception as e:
            logger.error(f"Failed to start preview tunnel for port {port}: {e}")
            return None

    async def stop_preview_tunnel(self, port: int) -> None:
        """Stop a specific preview tunnel.

        Args:
            port: The port of the preview tunnel to stop
        """
        process = self.preview_tunnels.pop(port, None)
        self.preview_urls.pop(port, None)

        if process:
            try:
                process.terminate()
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, process.wait)
            except Exception as e:
                logger.error(f"Error stopping preview tunnel for port {port}: {e}")

    async def stop_all_preview_tunnels(self) -> None:
        """Stop all preview tunnels."""
        ports = list(self.preview_tunnels.keys())
        for port in ports:
            await self.stop_preview_tunnel(port)
