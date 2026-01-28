"""Tests for Plugin ABC and QuickAction model."""

import pytest
from app.plugins.base import Plugin, QuickAction, PluginHealth


class TestQuickAction:
    def test_quick_action_fields(self):
        qa = QuickAction(label="Run tests", command="pytest", icon="play")
        assert qa.label == "Run tests"
        assert qa.command == "pytest"
        assert qa.icon == "play"

    def test_quick_action_to_dict(self):
        qa = QuickAction(label="Deploy", command="deploy --prod", icon="rocket")
        d = qa.to_dict()
        assert d == {"label": "Deploy", "command": "deploy --prod", "icon": "rocket"}


class TestPluginHealth:
    def test_healthy(self):
        h = PluginHealth(available=True)
        assert h.available is True
        assert h.message is None

    def test_unhealthy_with_message(self):
        h = PluginHealth(available=False, message="CLI not found")
        assert h.available is False
        assert h.message == "CLI not found"

    def test_to_dict(self):
        h = PluginHealth(available=True, message="ok")
        assert h.to_dict() == {"available": True, "message": "ok"}


class TestPluginABC:
    def test_cannot_instantiate_abstract(self):
        with pytest.raises(TypeError):
            Plugin()

    def test_concrete_plugin_must_set_attributes(self):
        class Incomplete(Plugin):
            async def initialize(self) -> bool:
                return True
            def get_quick_actions(self) -> list[QuickAction]:
                return []
            def get_health(self) -> PluginHealth:
                return PluginHealth(available=True)

        p = Incomplete()
        with pytest.raises(AttributeError):
            _ = p.name

    def test_valid_concrete_plugin(self):
        class MyPlugin(Plugin):
            name = "my-tool"
            display_name = "My Tool"
            command = "my-tool"

            async def initialize(self) -> bool:
                return True
            def get_quick_actions(self) -> list[QuickAction]:
                return [QuickAction(label="Status", command="status", icon="info")]
            def get_health(self) -> PluginHealth:
                return PluginHealth(available=True)

        p = MyPlugin()
        assert p.name == "my-tool"
        assert p.display_name == "My Tool"
        assert p.command == "my-tool"
        assert len(p.get_quick_actions()) == 1
        assert p.get_health().available is True

    def test_to_dict(self):
        class MyPlugin(Plugin):
            name = "test"
            display_name = "Test Plugin"
            command = "test-cli"

            async def initialize(self) -> bool:
                return True
            def get_quick_actions(self) -> list[QuickAction]:
                return [QuickAction(label="Go", command="go", icon="play")]
            def get_health(self) -> PluginHealth:
                return PluginHealth(available=True)

        p = MyPlugin()
        d = p.to_dict()
        assert d["name"] == "test"
        assert d["display_name"] == "Test Plugin"
        assert d["command"] == "test-cli"
        assert len(d["quick_actions"]) == 1
        assert d["health"]["available"] is True
