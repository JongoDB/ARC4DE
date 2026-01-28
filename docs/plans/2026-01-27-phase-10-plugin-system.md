# Phase 10: Plugin System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a plugin system with ABC base class, auto-discovery manager, API endpoints, and a Claude Code reference plugin — making ARC4DE extensible to any CLI tool.

**Architecture:** Python ABC defines the plugin contract (`Plugin` base class with `initialize`, `get_quick_actions`, `get_health` methods). A `PluginManager` auto-discovers plugins from `app/plugins/` and `plugins-community/` directories on startup. API endpoints expose plugin info to the frontend. Session creation accepts an optional `plugin` slug — when provided, tmux session runs the plugin's command instead of a bare shell. Frontend surfaces available plugins in the session picker and shows plugin name on session cards.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, pytest, React 18, TypeScript

---

## Task 1: Plugin ABC and QuickAction Model

**Files:**
- Modify: `backend/app/plugins/base.py`
- Create: `backend/tests/test_plugin_base.py`

**Step 1: Write the failing tests**

```python
# backend/tests/test_plugin_base.py
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

        # Missing required class attributes: name, display_name, command
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
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/JonWFH/jondev/ARC4DE && docker compose exec backend python -m pytest tests/test_plugin_base.py -v`
Expected: FAIL — `ImportError: cannot import name 'Plugin' from 'app.plugins.base'`

**Step 3: Implement the Plugin ABC, QuickAction, and PluginHealth**

```python
# backend/app/plugins/base.py
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
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/JonWFH/jondev/ARC4DE && docker compose exec backend python -m pytest tests/test_plugin_base.py -v`
Expected: PASS (all 7 tests)

**Step 5: Commit**

```bash
git add backend/app/plugins/base.py backend/tests/test_plugin_base.py
git commit -m "feat(plugins): implement Plugin ABC, QuickAction, and PluginHealth models"
```

---

## Task 2: PluginManager — Discovery and Registry

**Files:**
- Modify: `backend/app/plugins/manager.py`
- Create: `backend/tests/test_plugin_manager.py`

**Step 1: Write the failing tests**

```python
# backend/tests/test_plugin_manager.py
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
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/JonWFH/jondev/ARC4DE && docker compose exec backend python -m pytest tests/test_plugin_manager.py -v`
Expected: FAIL — `ImportError: cannot import name 'PluginManager'`

**Step 3: Implement PluginManager**

```python
# backend/app/plugins/manager.py
"""Plugin discovery, loading, and registry."""

import importlib
import logging
import os
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
        # Try importing as app.plugins.<name>.plugin or as standalone
        module_name = f"app.plugins.{package_name}.plugin"
        try:
            module = importlib.import_module(module_name)
        except ImportError:
            logger.debug("Could not import %s, skipping", module_name)
            return

        # Find the Plugin subclass in the module
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
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/JonWFH/jondev/ARC4DE && docker compose exec backend python -m pytest tests/test_plugin_manager.py -v`
Expected: PASS (all 7 tests). Note: `test_initialize_all` requires `pytest-asyncio` — this test will be skipped outside Docker, which is fine.

**Step 5: Commit**

```bash
git add backend/app/plugins/manager.py backend/tests/test_plugin_manager.py
git commit -m "feat(plugins): implement PluginManager with register, discover, and initialize"
```

---

## Task 3: Shell Built-in Plugin

**Files:**
- Create: `backend/app/plugins/shell/plugin.py`
- Create: `backend/app/plugins/shell/__init__.py`
- Create: `backend/tests/test_plugin_shell.py`

The shell plugin is the default — it runs a bare shell (no special CLI wrapping). This gives every session a plugin identity even without explicit selection.

**Step 1: Write the failing tests**

```python
# backend/tests/test_plugin_shell.py
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
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/JonWFH/jondev/ARC4DE && docker compose exec backend python -m pytest tests/test_plugin_shell.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.plugins.shell'`

**Step 3: Implement the Shell plugin**

```python
# backend/app/plugins/shell/__init__.py
```

```python
# backend/app/plugins/shell/plugin.py
"""Shell built-in plugin — default raw terminal, no CLI wrapping."""

from app.plugins.base import Plugin, QuickAction, PluginHealth


class ShellPlugin(Plugin):
    name = "shell"
    display_name = "Shell"
    command = ""  # Empty = use default shell

    async def initialize(self) -> bool:
        return True

    def get_quick_actions(self) -> list[QuickAction]:
        return []

    def get_health(self) -> PluginHealth:
        return PluginHealth(available=True)
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/JonWFH/jondev/ARC4DE && docker compose exec backend python -m pytest tests/test_plugin_shell.py -v`
Expected: PASS (all 6 tests)

**Step 5: Commit**

```bash
git add backend/app/plugins/shell/
git add backend/tests/test_plugin_shell.py
git commit -m "feat(plugins): add Shell built-in plugin (default raw terminal)"
```

---

## Task 4: Claude Code Reference Plugin

**Files:**
- Modify: `backend/app/plugins/claude_code/plugin.py`
- Create: `backend/tests/test_plugin_claude_code.py`

**Step 1: Write the failing tests**

```python
# backend/tests/test_plugin_claude_code.py
"""Tests for the Claude Code reference plugin."""

import asyncio
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
        # Result depends on whether `claude` binary is installed
        has_claude = shutil.which("claude") is not None
        assert result is has_claude

    def test_health_reflects_state(self):
        p = ClaudeCodePlugin()
        # Before initialize, health should report based on which()
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
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/JonWFH/jondev/ARC4DE && docker compose exec backend python -m pytest tests/test_plugin_claude_code.py -v`
Expected: FAIL — `ImportError: cannot import name 'ClaudeCodePlugin'`

**Step 3: Implement the Claude Code plugin**

```python
# backend/app/plugins/claude_code/plugin.py
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
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/JonWFH/jondev/ARC4DE && docker compose exec backend python -m pytest tests/test_plugin_claude_code.py -v`
Expected: PASS (all 6 tests)

**Step 5: Commit**

```bash
git add backend/app/plugins/claude_code/plugin.py backend/tests/test_plugin_claude_code.py
git commit -m "feat(plugins): add Claude Code reference plugin with quick actions"
```

---

## Task 5: Plugin API Endpoints

**Files:**
- Modify: `backend/app/api/plugins.py`
- Modify: `backend/app/main.py` (register router + manager startup)
- Create: `backend/tests/test_api_plugins.py`

**Step 1: Write the failing tests**

```python
# backend/tests/test_api_plugins.py
"""Tests for plugin API routes."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.auth import _token_store, _rate_limiter


@pytest.fixture(autouse=True)
def reset_auth_state():
    _token_store._active_jtis.clear()
    _rate_limiter.reset()
    yield
    _token_store._active_jtis.clear()
    _rate_limiter.reset()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    resp = client.post("/api/auth/login", json={"password": "test-password"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestListPlugins:
    def test_list_plugins(self, client, auth_headers):
        resp = client.get("/api/plugins", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        # At minimum, shell and claude-code should be present
        names = [p["name"] for p in data]
        assert "shell" in names
        assert "claude-code" in names

    def test_plugin_structure(self, client, auth_headers):
        resp = client.get("/api/plugins", headers=auth_headers)
        data = resp.json()
        for plugin in data:
            assert "name" in plugin
            assert "display_name" in plugin
            assert "command" in plugin
            assert "quick_actions" in plugin
            assert "health" in plugin
            assert "available" in plugin["health"]

    def test_unauthenticated(self, client):
        resp = client.get("/api/plugins")
        assert resp.status_code == 401


class TestGetPlugin:
    def test_get_existing(self, client, auth_headers):
        resp = client.get("/api/plugins/shell", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "shell"
        assert data["display_name"] == "Shell"

    def test_get_nonexistent(self, client, auth_headers):
        resp = client.get("/api/plugins/nonexistent", headers=auth_headers)
        assert resp.status_code == 404

    def test_unauthenticated(self, client):
        resp = client.get("/api/plugins/shell")
        assert resp.status_code == 401


class TestGetPluginHealth:
    def test_health_endpoint(self, client, auth_headers):
        resp = client.get("/api/plugins/shell/health", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["available"] is True

    def test_health_nonexistent(self, client, auth_headers):
        resp = client.get("/api/plugins/nonexistent/health", headers=auth_headers)
        assert resp.status_code == 404

    def test_unauthenticated(self, client):
        resp = client.get("/api/plugins/shell/health")
        assert resp.status_code == 401
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/JonWFH/jondev/ARC4DE && docker compose exec backend python -m pytest tests/test_api_plugins.py -v`
Expected: FAIL — routes return 405/404 (endpoints not implemented)

**Step 3: Implement the API routes and wire into main.py**

```python
# backend/app/api/plugins.py
"""Plugin management API routes (list available plugins, health)."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_user

router = APIRouter(prefix="/api/plugins", tags=["plugins"])

# The plugin manager is set during app startup (see main.py).
_plugin_manager = None


def set_plugin_manager(manager) -> None:
    """Called by main.py to inject the initialized PluginManager."""
    global _plugin_manager
    _plugin_manager = manager


def _get_manager():
    if _plugin_manager is None:
        raise RuntimeError("PluginManager not initialized")
    return _plugin_manager


@router.get("")
async def list_plugins(user: dict = Depends(get_current_user)) -> list[dict]:
    """List all registered plugins."""
    mgr = _get_manager()
    return [p.to_dict() for p in mgr.list_all()]


@router.get("/{name}")
async def get_plugin(name: str, user: dict = Depends(get_current_user)) -> dict:
    """Get details for a specific plugin."""
    mgr = _get_manager()
    plugin = mgr.get(name)
    if not plugin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plugin '{name}' not found",
        )
    return plugin.to_dict()


@router.get("/{name}/health")
async def get_plugin_health(
    name: str, user: dict = Depends(get_current_user)
) -> dict:
    """Get health status for a specific plugin."""
    mgr = _get_manager()
    plugin = mgr.get(name)
    if not plugin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plugin '{name}' not found",
        )
    return plugin.get_health().to_dict()
```

Now update `main.py` to import the plugins router, create the PluginManager, discover + register built-in plugins, and initialize them on startup:

```python
# backend/app/main.py — changes needed:

# Add to imports:
from app.api.plugins import router as plugins_router, set_plugin_manager
from app.plugins.manager import PluginManager

# In the lifespan function, BEFORE yield, add:
#   plugin_mgr = PluginManager()
#   plugin_mgr.discover(Path(__file__).resolve().parent / "plugins")
#   await plugin_mgr.initialize_all()
#   set_plugin_manager(plugin_mgr)

# Add to routes:
#   app.include_router(plugins_router)
```

Full updated `main.py`:

```python
# backend/app/main.py
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.plugins import router as plugins_router, set_plugin_manager
from app.api.sessions import router as sessions_router
from app.config import settings
from app.core.tmux import TmuxManager
from app.plugins.manager import PluginManager
from app.ws.terminal import terminal_handler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background cleanup and plugin discovery on startup."""
    # Plugin discovery
    plugin_mgr = PluginManager()
    plugin_mgr.discover(Path(__file__).resolve().parent / "plugins")
    await plugin_mgr.initialize_all()
    set_plugin_manager(plugin_mgr)

    # Session cleanup loop
    manager = TmuxManager()
    task = asyncio.create_task(_cleanup_loop(manager))
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


async def _cleanup_loop(manager: TmuxManager) -> None:
    """Periodically clean up expired tmux sessions."""
    while True:
        await asyncio.sleep(3600)  # Every hour
        try:
            removed = await manager.cleanup_expired_sessions()
            if removed:
                print(f"Cleaned up {len(removed)} expired session(s)")
        except Exception:
            pass


app = FastAPI(
    title="ARC4DE",
    description="Automated Remote Control for Distributed Environments",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth_router)
app.include_router(sessions_router)
app.include_router(plugins_router)

# WebSocket
app.add_websocket_route("/ws/terminal", terminal_handler)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/JonWFH/jondev/ARC4DE && docker compose exec backend python -m pytest tests/test_api_plugins.py -v`
Expected: PASS (all 9 tests)

**Step 5: Run all backend tests to check for regressions**

Run: `cd /Users/JonWFH/jondev/ARC4DE && docker compose exec backend python -m pytest tests/ -v`
Expected: All existing tests pass + new tests pass

**Step 6: Commit**

```bash
git add backend/app/api/plugins.py backend/app/main.py backend/tests/test_api_plugins.py
git commit -m "feat(plugins): add API endpoints and wire PluginManager into app startup"
```

---

## Task 6: Session Creation with Plugin Support

**Files:**
- Modify: `backend/app/core/tmux.py` (accept optional command in `create_session`)
- Modify: `backend/app/api/sessions.py` (accept optional `plugin` in create body)
- Modify: `backend/tests/test_api_sessions.py` (add plugin tests)

**Step 1: Write the failing tests**

Add to `backend/tests/test_api_sessions.py`:

```python
class TestCreateSessionWithPlugin:
    def test_create_with_shell_plugin(self, client, auth_headers):
        resp = client.post(
            "/api/sessions",
            json={"name": "shell-test", "plugin": "shell"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "shell-test"
        assert data["plugin"] == "shell"

    def test_create_with_unknown_plugin(self, client, auth_headers):
        resp = client.post(
            "/api/sessions",
            json={"name": "bad", "plugin": "nonexistent"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_create_without_plugin_defaults_to_shell(self, client, auth_headers):
        resp = client.post(
            "/api/sessions",
            json={"name": "default-test"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["plugin"] == "shell"

    def test_plugin_in_session_list(self, client, auth_headers):
        client.post(
            "/api/sessions",
            json={"name": "list-plugin-test", "plugin": "shell"},
            headers=auth_headers,
        )
        resp = client.get("/api/sessions", headers=auth_headers)
        session = next(
            s for s in resp.json() if s["name"] == "list-plugin-test"
        )
        assert session["plugin"] == "shell"
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/JonWFH/jondev/ARC4DE && docker compose exec backend python -m pytest tests/test_api_sessions.py::TestCreateSessionWithPlugin -v`
Expected: FAIL — `plugin` key not in response

**Step 3: Modify tmux.py to support plugin command**

Update `SessionInfo` dataclass to include `plugin` field. Update `create_session` to accept an optional `command` parameter — when provided, the tmux session runs that command.

Changes to `backend/app/core/tmux.py`:

- Add `plugin: str` field to `SessionInfo` dataclass (default `"shell"`)
- Add `plugin: str` to `to_dict()`
- Add `command: str = ""` and `plugin: str = "shell"` params to `create_session()`
- Store `plugin` in `_session_registry`
- If `command` is provided, run `tmux new-session -d -s <name> <command>`
- Return `plugin` from `list_sessions()` via registry

**Step 4: Modify sessions.py to accept plugin parameter**

Changes to `backend/app/api/sessions.py`:

- Add `plugin: str = "shell"` to `CreateSessionRequest`
- Look up plugin in `_plugin_manager` to get its `command`
- Pass `command` and `plugin` to `tmux_manager.create_session()`
- Return 404 if plugin not found

**Step 5: Run all session tests**

Run: `cd /Users/JonWFH/jondev/ARC4DE && docker compose exec backend python -m pytest tests/test_api_sessions.py -v`
Expected: All existing tests + new tests pass

**Step 6: Commit**

```bash
git add backend/app/core/tmux.py backend/app/api/sessions.py backend/tests/test_api_sessions.py
git commit -m "feat(sessions): support plugin selection on session creation"
```

---

## Task 7: Frontend — Plugin Types and Session Picker Integration

**Files:**
- Modify: `frontend/src/types/index.ts` (add PluginInfo type, update SessionInfo)
- Modify: `frontend/src/components/terminal/SessionPickerPage.tsx` (fetch plugins, show plugin selector on create, show plugin badge on cards)

**Step 1: Add frontend types**

Add to `frontend/src/types/index.ts`:

```typescript
export interface QuickAction {
  label: string;
  command: string;
  icon: string;
}

export interface PluginHealth {
  available: boolean;
  message: string | null;
}

export interface PluginInfo {
  name: string;
  display_name: string;
  command: string;
  quick_actions: QuickAction[];
  health: PluginHealth;
}
```

Update `SessionInfo` to include `plugin`:

```typescript
export interface SessionInfo {
  session_id: string;
  name: string;
  tmux_name: string;
  state: string;
  created_at: string;
  plugin: string;
}
```

**Step 2: Update SessionPickerPage**

Key changes to `SessionPickerPage.tsx`:

1. Add state: `plugins` (fetched from `GET /api/plugins`), `selectedPlugin` (default `"shell"`)
2. Fetch plugins on mount alongside sessions
3. In the "New Session" form, add a plugin selector (row of buttons or dropdown) showing each plugin's `display_name` and health dot
4. When creating a session, include `plugin` in the POST body
5. On session cards, show the plugin display name as a small badge (e.g., "Shell" or "Claude Code")
6. Only show healthy plugins as selectable

**Step 3: TypeScript compile check**

Run: `cd /Users/JonWFH/jondev/ARC4DE/frontend && npx tsc --noEmit`
Expected: Clean

**Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/components/terminal/SessionPickerPage.tsx
git commit -m "feat(frontend): add plugin types, plugin selector in session picker"
```

---

## Task 8: E2E Verification and CLAUDE.md Update

**Step 1: Run full backend test suite**

Run: `cd /Users/JonWFH/jondev/ARC4DE && docker compose exec backend python -m pytest tests/ -v`
Expected: All pass

**Step 2: Run frontend type check**

Run: `cd /Users/JonWFH/jondev/ARC4DE/frontend && npx tsc --noEmit`
Expected: Clean

**Step 3: Visual E2E verification (Playwright)**

1. Navigate to `http://localhost:5175/`
2. Click server → login → sessions page
3. Verify "New Session" form shows plugin selector with "Shell" and "Claude Code"
4. Create a session with "Shell" selected → verify it appears with "Shell" badge
5. Create a session with "Claude Code" selected → verify it appears with "Claude Code" badge
6. Click a session → terminal connects
7. Navigate to sessions → sessions still listed with correct plugin badges

**Step 4: Verify API directly**

```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"changeme"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# List plugins
curl -s http://localhost:8000/api/plugins -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Get specific plugin
curl -s http://localhost:8000/api/plugins/claude-code -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Plugin health
curl -s http://localhost:8000/api/plugins/shell/health -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Create session with plugin
curl -s -X POST http://localhost:8000/api/sessions \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"test","plugin":"shell"}' | python3 -m json.tool
```

**Step 5: Update CLAUDE.md**

- Change Phase line to: `**Phase:** Phase 11 - Quick Actions (NOT STARTED)`
- Update last completed to: `Phase 10 - Plugin System (Plugin ABC, PluginManager, Shell + Claude Code plugins, API endpoints, plugin-aware sessions)`
- Update Phase table: mark Phase 9 COMPLETE, Phase 10 COMPLETE

**Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark Phase 10 Plugin System complete"
```
