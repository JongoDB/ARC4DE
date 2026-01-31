# Ephemeral Cloudflare Tunnels Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic Cloudflare tunnel creation for remote ARC4DE access and app previews.

**Architecture:** Backend spawns cloudflared subprocesses, parses URLs from stderr, exposes via API and WebSocket. Frontend displays URLs in persistent header bar with copy/QR functionality.

**Tech Stack:** Python asyncio subprocess, cloudflared CLI, FastAPI, Zustand, React

---

## Task 1: TunnelManager Core - URL Parsing

**Files:**
- Create: `backend/app/core/tunnel.py`
- Create: `backend/tests/test_tunnel.py`

**Step 1: Write failing test for URL parsing**

```python
# backend/tests/test_tunnel.py
import pytest
from app.core.tunnel import parse_tunnel_url


class TestParseTunnelUrl:
    def test_parses_trycloudflare_url(self):
        stderr_output = """
2024-01-30T12:00:00Z INF +---------------------------------------------------+
2024-01-30T12:00:00Z INF |  Your quick tunnel has been created! Visit it at: |
2024-01-30T12:00:00Z INF |  https://random-words-here.trycloudflare.com       |
2024-01-30T12:00:00Z INF +---------------------------------------------------+
"""
        url = parse_tunnel_url(stderr_output)
        assert url == "https://random-words-here.trycloudflare.com"

    def test_returns_none_for_no_url(self):
        stderr_output = "Some random output without a URL"
        url = parse_tunnel_url(stderr_output)
        assert url is None

    def test_handles_multiline_with_noise(self):
        stderr_output = """
2024-01-30T12:00:00Z INF Starting tunnel
2024-01-30T12:00:00Z INF Connecting...
2024-01-30T12:00:00Z INF https://test-abc-123.trycloudflare.com
2024-01-30T12:00:00Z INF Tunnel established
"""
        url = parse_tunnel_url(stderr_output)
        assert url == "https://test-abc-123.trycloudflare.com"
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_tunnel.py -v
```
Expected: FAIL with "ModuleNotFoundError" or "ImportError"

**Step 3: Write minimal implementation**

```python
# backend/app/core/tunnel.py
"""Cloudflare tunnel management for remote access."""

import re

# Pattern to match trycloudflare.com URLs
TUNNEL_URL_PATTERN = re.compile(r"https://[\w-]+\.trycloudflare\.com")


def parse_tunnel_url(output: str) -> str | None:
    """Extract trycloudflare.com URL from cloudflared output."""
    match = TUNNEL_URL_PATTERN.search(output)
    return match.group(0) if match else None
```

**Step 4: Run test to verify it passes**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_tunnel.py -v
```
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/core/tunnel.py backend/tests/test_tunnel.py
git commit -m "feat(tunnel): add URL parsing for cloudflared output"
```

---

## Task 2: TunnelManager Class Structure

**Files:**
- Modify: `backend/app/core/tunnel.py`
- Modify: `backend/tests/test_tunnel.py`

**Step 1: Write failing test for TunnelManager**

```python
# Add to backend/tests/test_tunnel.py
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from app.core.tunnel import TunnelManager


class TestTunnelManager:
    def test_init_state(self):
        manager = TunnelManager()
        assert manager.session_url is None
        assert manager.session_process is None
        assert manager.preview_tunnels == {}
        assert manager.preview_urls == {}

    @pytest.mark.asyncio
    async def test_is_available_true_when_cloudflared_exists(self):
        manager = TunnelManager()
        with patch("shutil.which", return_value="/usr/local/bin/cloudflared"):
            assert manager.is_available() is True

    @pytest.mark.asyncio
    async def test_is_available_false_when_cloudflared_missing(self):
        manager = TunnelManager()
        with patch("shutil.which", return_value=None):
            assert manager.is_available() is False
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_tunnel.py::TestTunnelManager -v
```
Expected: FAIL with "ImportError" for TunnelManager

**Step 3: Write minimal implementation**

```python
# backend/app/core/tunnel.py - add to existing file
import asyncio
import shutil
from subprocess import Popen
from typing import Dict, Optional


class TunnelManager:
    """Manages cloudflared tunnel subprocesses."""

    def __init__(self):
        self.session_process: Optional[Popen] = None
        self.session_url: Optional[str] = None
        self.preview_tunnels: Dict[int, Popen] = {}  # port -> process
        self.preview_urls: Dict[int, str] = {}  # port -> url

    def is_available(self) -> bool:
        """Check if cloudflared binary is available."""
        return shutil.which("cloudflared") is not None
```

**Step 4: Run test to verify it passes**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_tunnel.py::TestTunnelManager -v
```
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/core/tunnel.py backend/tests/test_tunnel.py
git commit -m "feat(tunnel): add TunnelManager class structure"
```

---

## Task 3: Start Session Tunnel

**Files:**
- Modify: `backend/app/core/tunnel.py`
- Modify: `backend/tests/test_tunnel.py`

**Step 1: Write failing test for start_session_tunnel**

```python
# Add to backend/tests/test_tunnel.py TestTunnelManager class
    @pytest.mark.asyncio
    async def test_start_session_tunnel_success(self):
        manager = TunnelManager()

        mock_process = MagicMock()
        mock_process.stderr.readline = MagicMock(side_effect=[
            b"INF Starting tunnel\n",
            b"INF https://test-session.trycloudflare.com\n",
            b"INF Tunnel ready\n",
        ])
        mock_process.poll = MagicMock(return_value=None)

        with patch("shutil.which", return_value="/usr/local/bin/cloudflared"):
            with patch("subprocess.Popen", return_value=mock_process):
                url = await manager.start_session_tunnel(port=8000)

        assert url == "https://test-session.trycloudflare.com"
        assert manager.session_url == "https://test-session.trycloudflare.com"
        assert manager.session_process is mock_process

    @pytest.mark.asyncio
    async def test_start_session_tunnel_not_available(self):
        manager = TunnelManager()

        with patch("shutil.which", return_value=None):
            url = await manager.start_session_tunnel(port=8000)

        assert url is None
        assert manager.session_url is None
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_tunnel.py::TestTunnelManager::test_start_session_tunnel_success -v
```
Expected: FAIL with "AttributeError" - no start_session_tunnel method

**Step 3: Write minimal implementation**

```python
# backend/app/core/tunnel.py - add method to TunnelManager class
import subprocess
import logging

logger = logging.getLogger(__name__)

# Add to TunnelManager class:
    async def start_session_tunnel(self, port: int = 8000) -> Optional[str]:
        """Start the main ARC4DE session tunnel."""
        if not self.is_available():
            logger.warning("cloudflared not found - tunneling disabled")
            return None

        if self.session_process is not None:
            logger.warning("Session tunnel already running")
            return self.session_url

        try:
            self.session_process = subprocess.Popen(
                ["cloudflared", "tunnel", "--url", f"http://localhost:{port}"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

            # Read stderr lines until we find URL (with timeout)
            url = await self._read_tunnel_url(self.session_process)
            if url:
                self.session_url = url
                logger.info(f"Session tunnel started: {url}")
            else:
                logger.error("Failed to parse tunnel URL")
                await self.stop_session_tunnel()

            return self.session_url

        except Exception as e:
            logger.error(f"Failed to start session tunnel: {e}")
            return None

    async def _read_tunnel_url(self, process: Popen, timeout: float = 15.0) -> Optional[str]:
        """Read tunnel URL from cloudflared stderr with timeout."""
        loop = asyncio.get_event_loop()
        collected = ""
        deadline = asyncio.get_event_loop().time() + timeout

        while asyncio.get_event_loop().time() < deadline:
            if process.poll() is not None:
                # Process exited
                break

            try:
                line = await asyncio.wait_for(
                    loop.run_in_executor(None, process.stderr.readline),
                    timeout=1.0
                )
                if line:
                    collected += line.decode("utf-8", errors="replace")
                    url = parse_tunnel_url(collected)
                    if url:
                        return url
            except asyncio.TimeoutError:
                continue

        return parse_tunnel_url(collected)
```

**Step 4: Run test to verify it passes**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_tunnel.py::TestTunnelManager::test_start_session_tunnel_success -v
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_tunnel.py::TestTunnelManager::test_start_session_tunnel_not_available -v
```
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/core/tunnel.py backend/tests/test_tunnel.py
git commit -m "feat(tunnel): implement start_session_tunnel"
```

---

## Task 4: Stop Session Tunnel

**Files:**
- Modify: `backend/app/core/tunnel.py`
- Modify: `backend/tests/test_tunnel.py`

**Step 1: Write failing test**

```python
# Add to backend/tests/test_tunnel.py TestTunnelManager class
    @pytest.mark.asyncio
    async def test_stop_session_tunnel(self):
        manager = TunnelManager()

        mock_process = MagicMock()
        mock_process.terminate = MagicMock()
        mock_process.wait = MagicMock(return_value=0)
        mock_process.poll = MagicMock(return_value=None)

        manager.session_process = mock_process
        manager.session_url = "https://test.trycloudflare.com"

        await manager.stop_session_tunnel()

        mock_process.terminate.assert_called_once()
        assert manager.session_process is None
        assert manager.session_url is None

    @pytest.mark.asyncio
    async def test_stop_session_tunnel_when_none(self):
        manager = TunnelManager()
        # Should not raise
        await manager.stop_session_tunnel()
        assert manager.session_process is None
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_tunnel.py::TestTunnelManager::test_stop_session_tunnel -v
```
Expected: FAIL with "AttributeError" - no stop_session_tunnel method

**Step 3: Write minimal implementation**

```python
# backend/app/core/tunnel.py - add method to TunnelManager class
    async def stop_session_tunnel(self) -> None:
        """Stop the session tunnel."""
        if self.session_process is None:
            return

        try:
            self.session_process.terminate()
            # Wait for graceful shutdown
            loop = asyncio.get_event_loop()
            try:
                await asyncio.wait_for(
                    loop.run_in_executor(None, self.session_process.wait),
                    timeout=5.0
                )
            except asyncio.TimeoutError:
                self.session_process.kill()
                await loop.run_in_executor(None, self.session_process.wait)
        except Exception as e:
            logger.error(f"Error stopping session tunnel: {e}")
        finally:
            self.session_process = None
            self.session_url = None
            logger.info("Session tunnel stopped")
```

**Step 4: Run test to verify it passes**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_tunnel.py::TestTunnelManager::test_stop_session_tunnel -v
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_tunnel.py::TestTunnelManager::test_stop_session_tunnel_when_none -v
```
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/core/tunnel.py backend/tests/test_tunnel.py
git commit -m "feat(tunnel): implement stop_session_tunnel"
```

---

## Task 5: Configuration Settings

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/tests/test_tunnel.py`

**Step 1: Write failing test**

```python
# Add to backend/tests/test_tunnel.py
from app.config import settings


class TestTunnelConfig:
    def test_tunnel_enabled_default(self):
        # Default should be True
        assert hasattr(settings, "tunnel_enabled")
        assert settings.tunnel_enabled is True

    def test_tunnel_port_default(self):
        assert hasattr(settings, "tunnel_port")
        assert settings.tunnel_port == 8000
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_tunnel.py::TestTunnelConfig -v
```
Expected: FAIL with "AttributeError"

**Step 3: Write minimal implementation**

```python
# backend/app/config.py - add to Settings class
    # Tunnel
    tunnel_enabled: bool = True
    tunnel_port: int = 8000
```

**Step 4: Run test to verify it passes**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_tunnel.py::TestTunnelConfig -v
```
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/config.py backend/tests/test_tunnel.py
git commit -m "feat(tunnel): add tunnel config settings"
```

---

## Task 6: API Endpoint

**Files:**
- Create: `backend/app/api/tunnel.py`
- Create: `backend/tests/test_api_tunnel.py`

**Step 1: Write failing test**

```python
# backend/tests/test_api_tunnel.py
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


class TestTunnelEndpoint:
    def test_get_tunnel_info(self, client):
        # Mock the tunnel manager
        mock_manager = MagicMock()
        mock_manager.session_url = "https://test.trycloudflare.com"
        mock_manager.preview_urls = {3000: "https://preview.trycloudflare.com"}

        with patch("app.api.tunnel.get_tunnel_manager", return_value=mock_manager):
            response = client.get("/api/tunnel")

        assert response.status_code == 200
        data = response.json()
        assert data["session_url"] == "https://test.trycloudflare.com"
        assert data["previews"] == [{"port": 3000, "url": "https://preview.trycloudflare.com"}]

    def test_get_tunnel_info_no_tunnel(self, client):
        mock_manager = MagicMock()
        mock_manager.session_url = None
        mock_manager.preview_urls = {}

        with patch("app.api.tunnel.get_tunnel_manager", return_value=mock_manager):
            response = client.get("/api/tunnel")

        assert response.status_code == 200
        data = response.json()
        assert data["session_url"] is None
        assert data["previews"] == []
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_api_tunnel.py -v
```
Expected: FAIL with import error

**Step 3: Write minimal implementation**

```python
# backend/app/api/tunnel.py
"""Tunnel information API endpoint."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["tunnel"])

# Global tunnel manager reference (set by main.py)
_tunnel_manager = None


def set_tunnel_manager(manager) -> None:
    """Set the global tunnel manager reference."""
    global _tunnel_manager
    _tunnel_manager = manager


def get_tunnel_manager():
    """Get the global tunnel manager."""
    return _tunnel_manager


class PreviewInfo(BaseModel):
    port: int
    url: str


class TunnelInfo(BaseModel):
    session_url: str | None
    previews: list[PreviewInfo]


@router.get("/tunnel", response_model=TunnelInfo)
async def get_tunnel_info() -> TunnelInfo:
    """Get current tunnel URLs."""
    manager = get_tunnel_manager()

    if manager is None:
        return TunnelInfo(session_url=None, previews=[])

    previews = [
        PreviewInfo(port=port, url=url)
        for port, url in manager.preview_urls.items()
    ]

    return TunnelInfo(
        session_url=manager.session_url,
        previews=previews,
    )
```

**Step 4: Register router in main.py**

```python
# backend/app/main.py - add import
from app.api.tunnel import router as tunnel_router, set_tunnel_manager

# Add after other routers:
app.include_router(tunnel_router)
```

**Step 5: Run test to verify it passes**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_api_tunnel.py -v
```
Expected: PASS

**Step 6: Commit**

```bash
git add backend/app/api/tunnel.py backend/tests/test_api_tunnel.py backend/app/main.py
git commit -m "feat(tunnel): add /api/tunnel endpoint"
```

---

## Task 7: Lifespan Integration

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Update lifespan to start/stop tunnel**

```python
# backend/app/main.py - update imports
from app.core.tunnel import TunnelManager
from app.api.tunnel import router as tunnel_router, set_tunnel_manager
from app.config import settings

# Update lifespan function:
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background cleanup, plugins, and tunnel on startup."""
    # Plugin discovery
    plugin_mgr = PluginManager()
    plugin_mgr.discover(Path(__file__).resolve().parent / "plugins")
    await plugin_mgr.initialize_all()
    set_plugin_manager(plugin_mgr)

    # Tunnel manager
    tunnel_mgr = TunnelManager()
    set_tunnel_manager(tunnel_mgr)

    # Start session tunnel if enabled
    if settings.tunnel_enabled:
        await tunnel_mgr.start_session_tunnel(port=settings.tunnel_port)

    # Session cleanup loop
    manager = TmuxManager()
    task = asyncio.create_task(_cleanup_loop(manager))

    yield

    # Shutdown
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    # Stop tunnel
    await tunnel_mgr.stop_session_tunnel()
```

**Step 2: Run backend to verify it starts**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && timeout 10 python -m uvicorn app.main:app --port 8000 || true
```
Expected: Backend starts, logs tunnel status (may show warning if cloudflared not installed locally)

**Step 3: Run existing tests to ensure no regression**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/ -v --ignore=tests/test_ws_terminal.py
```
Expected: All tests pass

**Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(tunnel): integrate tunnel into FastAPI lifespan"
```

---

## Task 8: Dockerfile - Add cloudflared

**Files:**
- Modify: `backend/Dockerfile`

**Step 1: Update Dockerfile**

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

# Install system dependencies (tmux + cloudflared)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tmux \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install cloudflared (detect architecture)
ARG TARGETARCH
RUN ARCH=$(echo ${TARGETARCH} | sed 's/amd64/amd64/' | sed 's/arm64/arm64/') && \
    curl -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}" \
    -o /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 2: Build Docker image to verify**

```bash
cd /Users/JonWFH/jondev/ARC4DE && docker compose build backend
```
Expected: Build succeeds

**Step 3: Run container and verify cloudflared**

```bash
docker compose run --rm backend cloudflared --version
```
Expected: Shows cloudflared version

**Step 4: Commit**

```bash
git add backend/Dockerfile
git commit -m "feat(tunnel): add cloudflared to Docker image"
```

---

## Task 9: Frontend - Tunnel Store

**Files:**
- Create: `frontend/src/stores/tunnelStore.ts`

**Step 1: Create the store**

```typescript
// frontend/src/stores/tunnelStore.ts
import { create } from "zustand";

interface PreviewTunnel {
  port: number;
  url: string;
}

interface TunnelState {
  sessionUrl: string | null;
  previews: PreviewTunnel[];
  loading: boolean;
  error: string | null;

  fetchTunnelInfo: (serverUrl: string, token: string) => Promise<void>;
  addPreview: (port: number, url: string) => void;
  removePreview: (port: number) => void;
  clearTunnels: () => void;
}

export const useTunnelStore = create<TunnelState>()((set, get) => ({
  sessionUrl: null,
  previews: [],
  loading: false,
  error: null,

  fetchTunnelInfo: async (serverUrl: string, token: string) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${serverUrl}/api/tunnel`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      set({
        sessionUrl: data.session_url,
        previews: data.previews || [],
        loading: false,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to fetch tunnel info",
        loading: false,
      });
    }
  },

  addPreview: (port: number, url: string) => {
    const existing = get().previews.filter((p) => p.port !== port);
    set({ previews: [...existing, { port, url }] });
  },

  removePreview: (port: number) => {
    set({ previews: get().previews.filter((p) => p.port !== port) });
  },

  clearTunnels: () => {
    set({ sessionUrl: null, previews: [], error: null });
  },
}));
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/JonWFH/jondev/ARC4DE/frontend && npm run build 2>&1 | head -20
```
Expected: Build succeeds (or shows only unrelated warnings)

**Step 3: Commit**

```bash
git add frontend/src/stores/tunnelStore.ts
git commit -m "feat(tunnel): add frontend tunnel store"
```

---

## Task 10: Frontend - TunnelBar Component

**Files:**
- Create: `frontend/src/components/TunnelBar.tsx`

**Step 1: Create the component**

```tsx
// frontend/src/components/TunnelBar.tsx
import { useEffect, useState } from "react";
import { Link2, Copy, Check, QrCode, ExternalLink } from "lucide-react";
import { useTunnelStore } from "@/stores/tunnelStore";
import { useServerStore } from "@/stores/serverStore";

export function TunnelBar() {
  const { sessionUrl, previews, fetchTunnelInfo } = useTunnelStore();
  const { activeConnection, servers } = useServerStore();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const activeServer = servers.find(
    (s) => s.id === activeConnection?.serverId
  );

  // Fetch tunnel info on mount and periodically
  useEffect(() => {
    if (!activeServer || !activeConnection?.accessToken) return;

    fetchTunnelInfo(activeServer.url, activeConnection.accessToken);

    const interval = setInterval(() => {
      fetchTunnelInfo(activeServer.url, activeConnection.accessToken);
    }, 30000);

    return () => clearInterval(interval);
  }, [activeServer, activeConnection?.accessToken, fetchTunnelInfo]);

  const handleCopy = async () => {
    if (!sessionUrl) return;
    await navigator.clipboard.writeText(sessionUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!sessionUrl && previews.length === 0) {
    return null;
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 16px",
          backgroundColor: "var(--color-bg-tertiary)",
          borderBottom: "1px solid var(--color-border)",
          fontSize: "14px",
          flexWrap: "wrap",
        }}
      >
        {/* Session URL */}
        {sessionUrl && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Link2 size={16} style={{ color: "var(--color-accent)" }} />
            <span
              style={{
                color: "var(--color-text-secondary)",
                fontFamily: "monospace",
                fontSize: "13px",
              }}
            >
              {sessionUrl.replace("https://", "")}
            </span>
            <button
              onClick={handleCopy}
              title="Copy URL"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "4px",
                border: "none",
                backgroundColor: "transparent",
                color: copied
                  ? "var(--color-success)"
                  : "var(--color-text-muted)",
                cursor: "pointer",
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <button
              onClick={() => setShowQR(true)}
              title="Show QR Code"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "4px",
                border: "none",
                backgroundColor: "transparent",
                color: "var(--color-text-muted)",
                cursor: "pointer",
              }}
            >
              <QrCode size={14} />
            </button>
          </div>
        )}

        {/* Preview URLs */}
        {previews.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginLeft: sessionUrl ? "12px" : 0,
              paddingLeft: sessionUrl ? "12px" : 0,
              borderLeft: sessionUrl
                ? "1px solid var(--color-border)"
                : "none",
            }}
          >
            <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>
              Previews:
            </span>
            {previews.map((preview) => (
              <a
                key={preview.port}
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  backgroundColor: "var(--color-accent-muted)",
                  color: "var(--color-accent)",
                  fontSize: "12px",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                :{preview.port}
                <ExternalLink size={12} />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQR && sessionUrl && (
        <div
          onClick={() => setShowQR(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              padding: "24px",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <h3
              style={{
                color: "var(--color-text-primary)",
                marginBottom: "16px",
                fontSize: "18px",
              }}
            >
              Scan to Connect
            </h3>
            {/* QR Code placeholder - will use a library */}
            <div
              style={{
                width: "200px",
                height: "200px",
                backgroundColor: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                borderRadius: "8px",
              }}
            >
              <span style={{ color: "#333", fontSize: "12px" }}>
                QR: {sessionUrl}
              </span>
            </div>
            <p
              style={{
                color: "var(--color-text-muted)",
                fontSize: "13px",
                fontFamily: "monospace",
              }}
            >
              {sessionUrl}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/JonWFH/jondev/ARC4DE/frontend && npm run build 2>&1 | head -20
```
Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/src/components/TunnelBar.tsx
git commit -m "feat(tunnel): add TunnelBar component"
```

---

## Task 11: Frontend - Layout Integration

**Files:**
- Modify: `frontend/src/layouts/DesktopLayout.tsx`
- Modify: `frontend/src/layouts/MobileLayout.tsx`
- Modify: `frontend/src/layouts/TabletLayout.tsx`

**Step 1: Update DesktopLayout**

```tsx
// frontend/src/layouts/DesktopLayout.tsx - add import
import { TunnelBar } from "@/components/TunnelBar";

// Add TunnelBar after sidebar, before main content div:
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TunnelBar />
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px' }}>
            <Outlet />
          </div>
        </main>
      </div>
```

**Step 2: Update MobileLayout**

```tsx
// frontend/src/layouts/MobileLayout.tsx - add import
import { TunnelBar } from "@/components/TunnelBar";

// Add TunnelBar after header, before main:
      {/* Header */}
      <header>...</header>

      <TunnelBar />

      {/* Content */}
      <main>...</main>
```

**Step 3: Update TabletLayout**

```tsx
// frontend/src/layouts/TabletLayout.tsx - add import
import { TunnelBar } from "@/components/TunnelBar";

// Add TunnelBar in main content area:
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TunnelBar />
        <main className="flex-1 overflow-y-auto">
          <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px' }}>
            <Outlet />
          </div>
        </main>
      </div>
```

**Step 4: Verify build**

```bash
cd /Users/JonWFH/jondev/ARC4DE/frontend && npm run build
```
Expected: Build succeeds

**Step 5: Commit**

```bash
git add frontend/src/layouts/DesktopLayout.tsx frontend/src/layouts/MobileLayout.tsx frontend/src/layouts/TabletLayout.tsx
git commit -m "feat(tunnel): integrate TunnelBar into layouts"
```

---

## Task 12: Preview Detection - Output Parser

**Files:**
- Modify: `backend/app/core/tunnel.py`
- Modify: `backend/tests/test_tunnel.py`

**Step 1: Write failing test**

```python
# Add to backend/tests/test_tunnel.py
from app.core.tunnel import detect_server_port


class TestDetectServerPort:
    def test_detect_vite_port(self):
        output = "  VITE v5.0.0  ready in 500 ms\n\n  ➜  Local:   http://localhost:5173/"
        assert detect_server_port(output) == 5173

    def test_detect_next_port(self):
        output = "ready - started server on 0.0.0.0:3000, url: http://localhost:3000"
        assert detect_server_port(output) == 3000

    def test_detect_express_port(self):
        output = "Server listening on port 8080"
        assert detect_server_port(output) == 8080

    def test_detect_python_port(self):
        output = "Uvicorn running on http://127.0.0.1:8000"
        assert detect_server_port(output) == 8000

    def test_no_detection(self):
        output = "Just some random output"
        assert detect_server_port(output) is None

    def test_ignores_common_false_positives(self):
        # Port 8000 is ARC4DE itself, should be ignored
        output = "listening on port 8000"
        assert detect_server_port(output, ignore_ports={8000}) is None
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_tunnel.py::TestDetectServerPort -v
```
Expected: FAIL with ImportError

**Step 3: Write minimal implementation**

```python
# backend/app/core/tunnel.py - add function
PREVIEW_PATTERNS = [
    re.compile(r"listening on (?:port )?(\d+)", re.IGNORECASE),
    re.compile(r"Local:\s+https?://(?:localhost|127\.0\.0\.1):(\d+)"),
    re.compile(r"ready on https?://(?:localhost|127\.0\.0\.1):(\d+)"),
    re.compile(r"started server on.*:(\d+)"),
    re.compile(r"Server (?:running|listening) (?:on|at) https?://(?:localhost|127\.0\.0\.1):(\d+)", re.IGNORECASE),
    re.compile(r"running on https?://(?:localhost|127\.0\.0\.1):(\d+)", re.IGNORECASE),
]

DEFAULT_IGNORE_PORTS = {8000}  # ARC4DE backend


def detect_server_port(output: str, ignore_ports: set[int] | None = None) -> int | None:
    """Detect a dev server port from terminal output."""
    if ignore_ports is None:
        ignore_ports = DEFAULT_IGNORE_PORTS

    for pattern in PREVIEW_PATTERNS:
        match = pattern.search(output)
        if match:
            port = int(match.group(1))
            if port not in ignore_ports:
                return port
    return None
```

**Step 4: Run test to verify it passes**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_tunnel.py::TestDetectServerPort -v
```
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/core/tunnel.py backend/tests/test_tunnel.py
git commit -m "feat(tunnel): add server port detection from terminal output"
```

---

## Task 13: Preview Tunnel Management

**Files:**
- Modify: `backend/app/core/tunnel.py`
- Modify: `backend/tests/test_tunnel.py`

**Step 1: Write failing test**

```python
# Add to backend/tests/test_tunnel.py TestTunnelManager class
    @pytest.mark.asyncio
    async def test_start_preview_tunnel(self):
        manager = TunnelManager()

        mock_process = MagicMock()
        mock_process.stderr.readline = MagicMock(side_effect=[
            b"INF https://preview-3000.trycloudflare.com\n",
        ])
        mock_process.poll = MagicMock(return_value=None)

        with patch("shutil.which", return_value="/usr/local/bin/cloudflared"):
            with patch("subprocess.Popen", return_value=mock_process):
                url = await manager.start_preview_tunnel(port=3000)

        assert url == "https://preview-3000.trycloudflare.com"
        assert manager.preview_urls[3000] == "https://preview-3000.trycloudflare.com"
        assert 3000 in manager.preview_tunnels

    @pytest.mark.asyncio
    async def test_stop_preview_tunnel(self):
        manager = TunnelManager()

        mock_process = MagicMock()
        mock_process.terminate = MagicMock()
        mock_process.wait = MagicMock(return_value=0)

        manager.preview_tunnels[3000] = mock_process
        manager.preview_urls[3000] = "https://preview.trycloudflare.com"

        await manager.stop_preview_tunnel(3000)

        assert 3000 not in manager.preview_tunnels
        assert 3000 not in manager.preview_urls

    @pytest.mark.asyncio
    async def test_stop_all_preview_tunnels(self):
        manager = TunnelManager()

        mock_proc1 = MagicMock()
        mock_proc1.terminate = MagicMock()
        mock_proc1.wait = MagicMock(return_value=0)

        mock_proc2 = MagicMock()
        mock_proc2.terminate = MagicMock()
        mock_proc2.wait = MagicMock(return_value=0)

        manager.preview_tunnels = {3000: mock_proc1, 5173: mock_proc2}
        manager.preview_urls = {3000: "url1", 5173: "url2"}

        await manager.stop_all_preview_tunnels()

        assert manager.preview_tunnels == {}
        assert manager.preview_urls == {}
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_tunnel.py::TestTunnelManager::test_start_preview_tunnel -v
```
Expected: FAIL

**Step 3: Write minimal implementation**

```python
# backend/app/core/tunnel.py - add methods to TunnelManager class
    async def start_preview_tunnel(self, port: int) -> Optional[str]:
        """Start a tunnel for a dev server preview."""
        if not self.is_available():
            return None

        if port in self.preview_tunnels:
            return self.preview_urls.get(port)

        try:
            process = subprocess.Popen(
                ["cloudflared", "tunnel", "--url", f"http://localhost:{port}"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

            url = await self._read_tunnel_url(process)
            if url:
                self.preview_tunnels[port] = process
                self.preview_urls[port] = url
                logger.info(f"Preview tunnel started for port {port}: {url}")
                return url
            else:
                process.terminate()
                process.wait()
                return None

        except Exception as e:
            logger.error(f"Failed to start preview tunnel for port {port}: {e}")
            return None

    async def stop_preview_tunnel(self, port: int) -> None:
        """Stop a specific preview tunnel."""
        process = self.preview_tunnels.pop(port, None)
        self.preview_urls.pop(port, None)

        if process:
            try:
                process.terminate()
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, process.wait)
            except Exception as e:
                logger.error(f"Error stopping preview tunnel for port {port}: {e}")

    async def stop_all_preview_tunnels(self) -> None:
        """Stop all preview tunnels."""
        ports = list(self.preview_tunnels.keys())
        for port in ports:
            await self.stop_preview_tunnel(port)
```

**Step 4: Run test to verify it passes**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_tunnel.py::TestTunnelManager::test_start_preview_tunnel -v
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_tunnel.py::TestTunnelManager::test_stop_preview_tunnel -v
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_tunnel.py::TestTunnelManager::test_stop_all_preview_tunnels -v
```
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/core/tunnel.py backend/tests/test_tunnel.py
git commit -m "feat(tunnel): add preview tunnel management"
```

---

## Task 14: WebSocket Preview Integration

**Files:**
- Modify: `backend/app/ws/terminal.py`
- Modify: `backend/app/api/tunnel.py`

**Step 1: Add tunnel manager access and output scanning**

```python
# backend/app/ws/terminal.py - update imports
from app.core.tunnel import detect_server_port
from app.api.tunnel import get_tunnel_manager

# Modify _pty_reader to scan output:
async def _pty_reader(master_fd: int, websocket: WebSocket) -> None:
    """Read from PTY master and send output to WebSocket."""
    loop = asyncio.get_event_loop()
    tunnel_manager = get_tunnel_manager()
    recent_output = ""  # Buffer for port detection

    try:
        while True:
            try:
                data = await loop.run_in_executor(
                    None, _blocking_read, master_fd
                )
                if not data:
                    break

                text = data.decode("utf-8", errors="replace")

                # Scan for dev server ports
                if tunnel_manager:
                    recent_output += text
                    # Keep only last 1KB for scanning
                    recent_output = recent_output[-1024:]

                    port = detect_server_port(recent_output)
                    if port and port not in tunnel_manager.preview_urls:
                        # Start preview tunnel in background
                        asyncio.create_task(
                            _start_preview_and_notify(tunnel_manager, port, websocket)
                        )

                await websocket.send_json({
                    "type": "output",
                    "data": text,
                })
            except OSError:
                break
    except asyncio.CancelledError:
        pass
    except Exception:
        pass


async def _start_preview_and_notify(tunnel_manager, port: int, websocket: WebSocket) -> None:
    """Start a preview tunnel and notify the client."""
    try:
        url = await tunnel_manager.start_preview_tunnel(port)
        if url:
            await _send(websocket, {
                "type": "tunnel.preview",
                "port": port,
                "url": url,
            })
    except Exception:
        pass
```

**Step 2: Run existing tests to ensure no regression**

```bash
cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/ -v --ignore=tests/test_ws_terminal.py
```
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/app/ws/terminal.py
git commit -m "feat(tunnel): integrate preview detection into WebSocket handler"
```

---

## Task 15: Frontend - Handle WebSocket Tunnel Messages

**Files:**
- Modify: `frontend/src/hooks/useWebSocket.ts` or equivalent WebSocket handler

**Step 1: Find and update WebSocket message handler**

First, locate the WebSocket handling code:

```bash
grep -r "tunnel.preview\|type.*output" frontend/src/ --include="*.ts" --include="*.tsx"
```

Then update to handle tunnel messages:

```typescript
// In the WebSocket message handler, add cases for tunnel messages:
if (msg.type === "tunnel.preview") {
  // Import and use tunnel store
  useTunnelStore.getState().addPreview(msg.port, msg.url);
}

if (msg.type === "tunnel.preview.closed") {
  useTunnelStore.getState().removePreview(msg.port);
}
```

**Step 2: Verify build**

```bash
cd /Users/JonWFH/jondev/ARC4DE/frontend && npm run build
```
Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/src/
git commit -m "feat(tunnel): handle WebSocket tunnel messages in frontend"
```

---

## Task 16: Full Integration Test

**Step 1: Rebuild Docker**

```bash
cd /Users/JonWFH/jondev/ARC4DE && docker compose build
```

**Step 2: Start services**

```bash
docker compose up -d
```

**Step 3: Check logs for tunnel URL**

```bash
docker compose logs backend | grep -i tunnel
```
Expected: See "Session tunnel started: https://xxx.trycloudflare.com"

**Step 4: Verify API endpoint**

```bash
curl http://localhost:8000/api/tunnel
```
Expected: JSON with session_url

**Step 5: Open frontend and verify TunnelBar**

Open http://localhost:5175 in browser, verify TunnelBar shows the tunnel URL

**Step 6: Commit final version bump**

```bash
# Update version in package.json to 0.13.0
git add .
git commit -m "feat(tunnel): complete ephemeral tunnel implementation"
git tag -a v0.13.0 -m "v0.13.0 - Ephemeral Cloudflare Tunnels"
git push origin master --tags
```

---

## Success Criteria

- [ ] Backend starts cloudflared tunnel automatically
- [ ] Session URL exposed via `/api/tunnel`
- [ ] TunnelBar displays URL with copy button
- [ ] QR code modal works
- [ ] Dev server detection creates preview tunnels
- [ ] Preview URLs appear in TunnelBar
- [ ] WebSocket broadcasts tunnel.preview messages
- [ ] Docker deployment includes cloudflared
- [ ] Graceful fallback when cloudflared unavailable
- [ ] All tests pass
