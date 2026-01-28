"""Claude Code reference plugin.

Wraps the `claude` CLI for AI-assisted coding sessions.
"""

import shutil

from app.plugins.base import Plugin, QuickAction, PluginHealth


class ClaudeCodePlugin(Plugin):
    name = "claude-code"
    display_name = "Claude Code"
    command = "claude"

    async def initialize(self) -> bool:
        """Check if the claude CLI is installed."""
        return shutil.which("claude") is not None

    def get_quick_actions(self) -> list[QuickAction]:
        return [
            QuickAction(
                label="New conversation",
                command="claude",
                icon="chat",
            ),
            QuickAction(
                label="Continue last",
                command="claude --continue",
                icon="arrow-right",
            ),
            QuickAction(
                label="Resume session",
                command="claude --resume",
                icon="rotate",
            ),
        ]

    def get_health(self) -> PluginHealth:
        available = shutil.which("claude") is not None
        return PluginHealth(
            available=available,
            message=None if available else "claude CLI not found in PATH",
        )
