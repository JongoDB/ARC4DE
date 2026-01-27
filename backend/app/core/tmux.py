"""tmux session management wrapper.

Provides async Python interface to tmux CLI for creating, listing,
and managing persistent terminal sessions.
"""

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.config import settings


@dataclass
class SessionInfo:
    """Metadata about a tmux session."""

    session_id: str
    name: str
    tmux_name: str
    state: str  # "active" | "detached"
    created_at: str  # ISO 8601

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "name": self.name,
            "tmux_name": self.tmux_name,
            "state": self.state,
            "created_at": self.created_at,
        }


# In-memory registry mapping session_id -> display name + created_at.
# tmux itself doesn't store custom metadata, so we track it here.
# Resets on backend restart -- we reconcile with live tmux sessions.
_session_registry: dict[str, dict] = {}


async def _run_tmux(*args: str) -> tuple[int, str, str]:
    """Run a tmux command and return (returncode, stdout, stderr)."""
    proc = await asyncio.create_subprocess_exec(
        "tmux",
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return proc.returncode, stdout.decode().strip(), stderr.decode().strip()


class TmuxManager:
    """Async wrapper around tmux CLI for session management."""

    async def create_session(self, name: str) -> SessionInfo:
        """Create a new tmux session."""
        session_id = uuid4().hex[:12]
        tmux_name = f"arc4de-{session_id}"
        now = datetime.now(timezone.utc).isoformat()

        rc, _, stderr = await _run_tmux(
            "new-session", "-d", "-s", tmux_name, "-x", "200", "-y", "50"
        )
        if rc != 0:
            raise RuntimeError(f"Failed to create tmux session: {stderr}")

        _session_registry[session_id] = {"name": name, "created_at": now}

        return SessionInfo(
            session_id=session_id,
            name=name,
            tmux_name=tmux_name,
            state="detached",
            created_at=now,
        )

    async def list_sessions(self) -> list[SessionInfo]:
        """List all arc4de-managed tmux sessions."""
        rc, stdout, _ = await _run_tmux(
            "list-sessions", "-F", "#{session_name}:#{session_attached}"
        )
        if rc != 0 or not stdout:
            return []

        sessions = []
        for line in stdout.splitlines():
            parts = line.split(":")
            if len(parts) < 2:
                continue
            tmux_name, attached = parts[0], parts[1]
            if not tmux_name.startswith("arc4de-"):
                continue

            session_id = tmux_name.removeprefix("arc4de-")
            state = "active" if attached != "0" else "detached"

            reg = _session_registry.get(session_id, {})
            name = reg.get("name", session_id)
            created_at = reg.get("created_at", "")

            sessions.append(
                SessionInfo(
                    session_id=session_id,
                    name=name,
                    tmux_name=tmux_name,
                    state=state,
                    created_at=created_at,
                )
            )

        return sessions

    async def session_exists(self, session_id: str) -> bool:
        """Check if a tmux session is alive."""
        tmux_name = f"arc4de-{session_id}"
        rc, _, _ = await _run_tmux("has-session", "-t", tmux_name)
        return rc == 0

    async def kill_session(self, session_id: str) -> None:
        """Kill a tmux session."""
        if not await self.session_exists(session_id):
            raise ValueError(f"Session {session_id} not found")

        tmux_name = f"arc4de-{session_id}"
        rc, _, stderr = await _run_tmux("kill-session", "-t", tmux_name)
        if rc != 0:
            raise RuntimeError(f"Failed to kill session: {stderr}")

        _session_registry.pop(session_id, None)

    async def send_keys(self, session_id: str, keys: str) -> None:
        """Send keystrokes to a tmux session."""
        if not await self.session_exists(session_id):
            raise ValueError(f"Session {session_id} not found")

        tmux_name = f"arc4de-{session_id}"
        rc, _, stderr = await _run_tmux("send-keys", "-t", tmux_name, keys, "Enter")
        if rc != 0:
            raise RuntimeError(f"Failed to send keys: {stderr}")

    async def capture_output(self, session_id: str, lines: int = 50) -> str:
        """Capture visible pane content from a tmux session."""
        if not await self.session_exists(session_id):
            raise ValueError(f"Session {session_id} not found")

        tmux_name = f"arc4de-{session_id}"
        rc, stdout, stderr = await _run_tmux(
            "capture-pane", "-t", tmux_name, "-p", "-S", f"-{lines}"
        )
        if rc != 0:
            raise RuntimeError(f"Failed to capture output: {stderr}")

        return stdout

    async def cleanup_expired_sessions(
        self, ttl_hours: int | None = None
    ) -> list[str]:
        """Kill sessions that have been alive longer than TTL."""
        ttl = ttl_hours if ttl_hours is not None else settings.session_ttl_hours
        cutoff = datetime.now(timezone.utc) - timedelta(hours=ttl)
        removed = []

        sessions = await self.list_sessions()
        for session in sessions:
            reg = _session_registry.get(session.session_id, {})
            created_str = reg.get("created_at", "")
            if not created_str:
                continue

            created = datetime.fromisoformat(created_str)
            if created < cutoff:
                try:
                    await self.kill_session(session.session_id)
                    removed.append(session.session_id)
                except Exception:
                    pass

        return removed
