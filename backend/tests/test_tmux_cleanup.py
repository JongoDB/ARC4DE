"""Tests for tmux session cleanup."""

import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from app.core.tmux import TmuxManager, _session_registry


@pytest.fixture
def manager():
    return TmuxManager()


@pytest.fixture(autouse=True)
async def cleanup_sessions(manager):
    yield
    sessions = await manager.list_sessions()
    for s in sessions:
        try:
            await manager.kill_session(s.session_id)
        except Exception:
            pass


class TestCleanupExpired:
    @pytest.mark.asyncio
    async def test_removes_expired_session(self, manager):
        info = await manager.create_session("expire-test")
        # Backdate the created_at to simulate an old session
        _session_registry[info.session_id]["created_at"] = (
            datetime.now(timezone.utc) - timedelta(hours=25)
        ).isoformat()

        removed = await manager.cleanup_expired_sessions(ttl_hours=24)
        assert info.session_id in removed
        assert await manager.session_exists(info.session_id) is False

    @pytest.mark.asyncio
    async def test_keeps_fresh_session(self, manager):
        info = await manager.create_session("fresh-test")
        removed = await manager.cleanup_expired_sessions(ttl_hours=24)
        assert info.session_id not in removed
        assert await manager.session_exists(info.session_id) is True

    @pytest.mark.asyncio
    async def test_returns_list_of_removed_ids(self, manager):
        info1 = await manager.create_session("old-1")
        info2 = await manager.create_session("old-2")
        await manager.create_session("new-1")

        # Backdate old sessions
        old_time = (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat()
        _session_registry[info1.session_id]["created_at"] = old_time
        _session_registry[info2.session_id]["created_at"] = old_time

        removed = await manager.cleanup_expired_sessions(ttl_hours=24)
        assert len(removed) == 2
        assert info1.session_id in removed
        assert info2.session_id in removed
