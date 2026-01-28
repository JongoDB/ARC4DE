"""Tests for the Shell built-in plugin."""

import pytest
from app.plugins.shell.plugin import ShellPlugin
from app.plugins.base import Plugin, QuickAction, PluginHealth


class TestShellPlugin:
    def test_is_plugin_subclass(self):
        assert issubclass(ShellPlugin, Plugin)

    def test_attributes(self):
        p = ShellPlugin()
        assert p.name == "shell"
        assert p.display_name == "Shell"
        assert p.command == ""

    @pytest.mark.asyncio
    async def test_initialize(self):
        p = ShellPlugin()
        assert await p.initialize() is True

    def test_health(self):
        p = ShellPlugin()
        h = p.get_health()
        assert h.available is True

    def test_quick_actions_empty(self):
        p = ShellPlugin()
        assert p.get_quick_actions() == []

    def test_to_dict(self):
        p = ShellPlugin()
        d = p.to_dict()
        assert d["name"] == "shell"
        assert d["command"] == ""
