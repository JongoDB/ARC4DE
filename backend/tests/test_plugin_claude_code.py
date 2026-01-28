"""Tests for the Claude Code reference plugin."""

import shutil

import pytest
from app.plugins.claude_code.plugin import ClaudeCodePlugin
from app.plugins.base import Plugin


class TestClaudeCodePlugin:
    def test_is_plugin_subclass(self):
        assert issubclass(ClaudeCodePlugin, Plugin)

    def test_attributes(self):
        p = ClaudeCodePlugin()
        assert p.name == "claude-code"
        assert p.display_name == "Claude Code"
        assert p.command == "claude"

    @pytest.mark.asyncio
    async def test_initialize_reflects_cli_availability(self):
        p = ClaudeCodePlugin()
        result = await p.initialize()
        has_claude = shutil.which("claude") is not None
        assert result is has_claude

    def test_health_reflects_state(self):
        p = ClaudeCodePlugin()
        h = p.get_health()
        has_claude = shutil.which("claude") is not None
        assert h.available is has_claude

    def test_quick_actions(self):
        p = ClaudeCodePlugin()
        actions = p.get_quick_actions()
        assert len(actions) >= 2
        labels = [a.label for a in actions]
        assert "New conversation" in labels
        assert "Continue last" in labels

    def test_to_dict_structure(self):
        p = ClaudeCodePlugin()
        d = p.to_dict()
        assert d["name"] == "claude-code"
        assert "quick_actions" in d
        assert "health" in d
        assert isinstance(d["quick_actions"], list)
