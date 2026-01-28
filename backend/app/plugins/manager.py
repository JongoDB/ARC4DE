"""Plugin discovery, loading, and registry."""

import importlib
import logging
from pathlib import Path

from app.plugins.base import Plugin

logger = logging.getLogger(__name__)


class PluginManager:
    """Discovers, loads, and manages ARC4DE plugins."""

    def __init__(self) -> None:
        self._plugins: dict[str, Plugin] = {}

    def register(self, plugin: Plugin) -> None:
        """Register a plugin instance."""
        self._plugins[plugin.name] = plugin

    def get(self, name: str) -> Plugin | None:
        """Get a plugin by slug name."""
        return self._plugins.get(name)

    def list_all(self) -> list[Plugin]:
        """Return all registered plugins."""
        return list(self._plugins.values())

    def list_names(self) -> list[str]:
        """Return sorted list of registered plugin names."""
        return sorted(self._plugins.keys())

    async def initialize_all(self) -> dict[str, bool]:
        """Initialize all plugins. Returns {name: success} map."""
        results: dict[str, bool] = {}
        for name, plugin in self._plugins.items():
            try:
                results[name] = await plugin.initialize()
            except Exception as exc:
                logger.warning("Plugin %s failed to initialize: %s", name, exc)
                results[name] = False
        return results

    def discover(self, *directories: str | Path) -> None:
        """Scan directories for plugin packages and register them.

        Each directory should contain subdirectories with a plugin.py
        that defines a class inheriting from Plugin.
        """
        for directory in directories:
            dirpath = Path(directory)
            if not dirpath.is_dir():
                logger.debug("Plugin directory not found: %s", dirpath)
                continue

            for entry in sorted(dirpath.iterdir()):
                if not entry.is_dir() or entry.name.startswith(("_", ".")):
                    continue
                plugin_file = entry / "plugin.py"
                if not plugin_file.exists():
                    continue

                try:
                    self._load_plugin_from_path(entry)
                except Exception as exc:
                    logger.warning(
                        "Failed to load plugin from %s: %s", entry, exc
                    )

    def _load_plugin_from_path(self, package_dir: Path) -> None:
        """Load a single plugin from a package directory."""
        package_name = package_dir.name
        module_name = f"app.plugins.{package_name}.plugin"
        try:
            module = importlib.import_module(module_name)
        except ImportError:
            logger.debug("Could not import %s, skipping", module_name)
            return

        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if (
                isinstance(attr, type)
                and issubclass(attr, Plugin)
                and attr is not Plugin
                and hasattr(attr, "name")
            ):
                try:
                    instance = attr()
                    self.register(instance)
                    logger.info("Loaded plugin: %s (%s)", instance.name, instance.display_name)
                except Exception as exc:
                    logger.warning("Could not instantiate %s: %s", attr_name, exc)
