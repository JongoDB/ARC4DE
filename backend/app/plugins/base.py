"""Plugin abstract base class, QuickAction model, and PluginHealth status."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class QuickAction:
    """A one-tap action a plugin exposes to the frontend."""

    label: str
    command: str
    icon: str

    def to_dict(self) -> dict:
        return {"label": self.label, "command": self.command, "icon": self.icon}


@dataclass
class PluginHealth:
    """Health status for a plugin (is the CLI available?)."""

    available: bool
    message: str | None = None

    def to_dict(self) -> dict:
        return {"available": self.available, "message": self.message}


class Plugin(ABC):
    """Base class for all ARC4DE plugins.

    Subclasses must set these class attributes:
        name:         slug identifier (e.g. "claude-code")
        display_name: human label (e.g. "Claude Code")
        command:      CLI binary to run in tmux (e.g. "claude")
    """

    name: str
    display_name: str
    command: str

    @abstractmethod
    async def initialize(self) -> bool:
        """Verify prerequisites (CLI exists, etc.). Return True if healthy."""
        ...

    @abstractmethod
    def get_quick_actions(self) -> list[QuickAction]:
        """Return plugin-specific quick actions for the frontend."""
        ...

    @abstractmethod
    def get_health(self) -> PluginHealth:
        """Return current health status."""
        ...

    def to_dict(self) -> dict:
        """Serialize plugin info for API responses."""
        return {
            "name": self.name,
            "display_name": self.display_name,
            "command": self.command,
            "quick_actions": [qa.to_dict() for qa in self.get_quick_actions()],
            "health": self.get_health().to_dict(),
        }
