"""Tests for tmux session manager.

These tests require tmux to be installed (run inside Docker).
"""

import asyncio

import pytest

from app.core.tmux import TmuxManager, SessionInfo


@pytest.fixture
def manager():
    return TmuxManager()


@pytest.fixture(autouse=True)
async def cleanup_sessions(manager):
    """Kill any leftover arc4de test sessions after each test."""
    yield
    sessions = await manager.list_sessions()
    for s in sessions:
        try:
            await manager.kill_session(s.session_id)
        except Exception:
            pass


class TestCreateSession:
    @pytest.mark.asyncio
    async def test_creates_session(self, manager):
        info = await manager.create_session("test-create")
        assert info.session_id  # non-empty string
        assert info.name == "test-create"
        assert info.tmux_name.startswith("arc4de-")
        assert info.state in ("active", "detached")

    @pytest.mark.asyncio
    async def test_creates_unique_ids(self, manager):
        info1 = await manager.create_session("session-a")
        info2 = await manager.create_session("session-b")
        assert info1.session_id != info2.session_id


class TestListSessions:
    @pytest.mark.asyncio
    async def test_empty_initially(self, manager):
        sessions = await manager.list_sessions()
        # Filter to only test sessions (other tests might leave some)
        assert isinstance(sessions, list)

    @pytest.mark.asyncio
    async def test_lists_created_sessions(self, manager):
        await manager.create_session("list-test")
        sessions = await manager.list_sessions()
        names = [s.name for s in sessions]
        assert "list-test" in names

    @pytest.mark.asyncio
    async def test_only_arc4de_sessions(self, manager):
        """Should not list non-arc4de tmux sessions."""
        proc = await asyncio.create_subprocess_exec(
            "tmux", "new-session", "-d", "-s", "foreign-session",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.wait()
        try:
            sessions = await manager.list_sessions()
            tmux_names = [s.tmux_name for s in sessions]
            assert "foreign-session" not in tmux_names
        finally:
            proc2 = await asyncio.create_subprocess_exec(
                "tmux", "kill-session", "-t", "foreign-session",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc2.wait()


class TestSessionExists:
    @pytest.mark.asyncio
    async def test_exists_after_create(self, manager):
        info = await manager.create_session("exists-test")
        assert await manager.session_exists(info.session_id) is True

    @pytest.mark.asyncio
    async def test_not_exists_bogus_id(self, manager):
        assert await manager.session_exists("nonexistent") is False


class TestKillSession:
    @pytest.mark.asyncio
    async def test_kill_removes_session(self, manager):
        info = await manager.create_session("kill-test")
        await manager.kill_session(info.session_id)
        assert await manager.session_exists(info.session_id) is False

    @pytest.mark.asyncio
    async def test_kill_nonexistent_raises(self, manager):
        with pytest.raises(ValueError, match="not found"):
            await manager.kill_session("nonexistent")
