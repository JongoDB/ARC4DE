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

    def test_quick_actions_count(self):
        """Shell plugin should have at least 2 quick actions."""
        p = ShellPlugin()
        actions = p.get_quick_actions()
        assert len(actions) >= 2

    def test_quick_actions_clear_present(self):
        """Clear action should be present with correct attributes."""
        p = ShellPlugin()
        actions = p.get_quick_actions()
        clear_actions = [a for a in actions if a.command == "clear"]
        assert len(clear_actions) == 1
        clear_action = clear_actions[0]
        assert clear_action.label == "Clear"
        assert clear_action.command == "clear"
        assert clear_action.icon == "trash"

    def test_quick_actions_exit_present(self):
        """Exit action should be present with correct attributes."""
        p = ShellPlugin()
        actions = p.get_quick_actions()
        exit_actions = [a for a in actions if a.command == "exit"]
        assert len(exit_actions) == 1
        exit_action = exit_actions[0]
        assert exit_action.label == "Exit"
        assert exit_action.command == "exit"
        assert exit_action.icon == "x"

    def test_quick_actions_have_required_attributes(self):
        """Each quick action must have label, command, and icon."""
        p = ShellPlugin()
        actions = p.get_quick_actions()
        for action in actions:
            assert hasattr(action, "label") and action.label
            assert hasattr(action, "command") and action.command
            assert hasattr(action, "icon") and action.icon

    def test_to_dict(self):
        p = ShellPlugin()
        d = p.to_dict()
        assert d["name"] == "shell"
        assert d["command"] == ""
