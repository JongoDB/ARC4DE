"""Tests for PluginManager discovery and registry."""

import pytest
from app.plugins.base import Plugin, QuickAction, PluginHealth
from app.plugins.manager import PluginManager


class StubPlugin(Plugin):
    """A valid test plugin."""
    name = "stub"
    display_name = "Stub Plugin"
    command = "echo"

    async def initialize(self) -> bool:
        return True

    def get_quick_actions(self) -> list[QuickAction]:
        return []

    def get_health(self) -> PluginHealth:
        return PluginHealth(available=True)


class FailingPlugin(Plugin):
    """A plugin whose initialize() returns False."""
    name = "failing"
    display_name = "Failing Plugin"
    command = "nonexistent-binary-xyz"

    async def initialize(self) -> bool:
        return False

    def get_quick_actions(self) -> list[QuickAction]:
        return []

    def get_health(self) -> PluginHealth:
        return PluginHealth(available=False, message="CLI not found")


class TestPluginManager:
    def test_register_plugin(self):
        mgr = PluginManager()
        mgr.register(StubPlugin())
        assert "stub" in mgr.list_names()

    def test_get_plugin(self):
        mgr = PluginManager()
        mgr.register(StubPlugin())
        p = mgr.get("stub")
        assert p is not None
        assert p.display_name == "Stub Plugin"

    def test_get_nonexistent(self):
        mgr = PluginManager()
        assert mgr.get("nope") is None

    def test_list_all(self):
        mgr = PluginManager()
        mgr.register(StubPlugin())
        mgr.register(FailingPlugin())
        plugins = mgr.list_all()
        assert len(plugins) == 2
        names = [p.name for p in plugins]
        assert "stub" in names
        assert "failing" in names

    def test_duplicate_register_overwrites(self):
        mgr = PluginManager()
        mgr.register(StubPlugin())
        mgr.register(StubPlugin())
        assert len(mgr.list_all()) == 1

    @pytest.mark.asyncio
    async def test_initialize_all(self):
        mgr = PluginManager()
        mgr.register(StubPlugin())
        mgr.register(FailingPlugin())
        results = await mgr.initialize_all()
        assert results["stub"] is True
        assert results["failing"] is False

    def test_list_names(self):
        mgr = PluginManager()
        mgr.register(StubPlugin())
        assert mgr.list_names() == ["stub"]
