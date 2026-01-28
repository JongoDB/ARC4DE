"""Shell built-in plugin — default raw terminal, no CLI wrapping."""

from app.plugins.base import Plugin, QuickAction, PluginHealth


class ShellPlugin(Plugin):
    name = "shell"
    display_name = "Shell"
    command = ""  # Empty = use default shell

    async def initialize(self) -> bool:
        return True

    def get_quick_actions(self) -> list[QuickAction]:
        return [
            QuickAction(label="Clear", command="clear", icon="trash"),
            QuickAction(label="Exit", command="exit", icon="x"),
        ]

    def get_health(self) -> PluginHealth:
        return PluginHealth(available=True)
