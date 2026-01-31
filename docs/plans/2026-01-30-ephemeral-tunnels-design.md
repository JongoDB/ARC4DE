# Ephemeral Cloudflare Tunnels Design

## Overview

Each ARC4DE instance gets automatic remote access via Cloudflare's free TryCloudflare service. When the backend starts, it spawns a cloudflared tunnel and exposes a public URL. Additional tunnels are created automatically when Claude starts dev servers.

## Decisions

| Aspect | Decision |
|--------|----------|
| Tunnel management | Backend-managed subprocess |
| Session tunnel | Always starts on backend startup |
| Preview detection | Output parsing with regex patterns |
| URL display | Persistent header bar with copy/QR |
| Docker | Cloudflared binary in backend container |
| Error handling | Graceful fallback, retries, no crash |

---

## Architecture

### Session Tunnel (Primary)

When the ARC4DE backend starts, it spawns `cloudflared tunnel --url http://localhost:8000` as a subprocess. Cloudflared outputs a random URL like `https://abc-xyz-123.trycloudflare.com` to stderr. The backend parses this, stores it in memory, and exposes it via a new API endpoint (`GET /api/tunnel`). The frontend polls or fetches this on load and displays it in a persistent header bar.

The tunnel process is a child of the backend process. When the backend shuts down (graceful or crash), the tunnel dies automatically. No orphan cleanup needed.

### App Preview Tunnels (Secondary)

The WebSocket terminal handler already receives all terminal output to forward to xterm.js. We add a parser that scans output for server-start patterns:
- `listening on port \d+`
- `Local:\s+http://localhost:(\d+)`
- `ready on http://localhost:(\d+)`
- `started server on.*:(\d+)`

When a pattern matches, the backend spawns another cloudflared subprocess for that port. The preview URL is broadcast to the frontend via WebSocket (`type: "tunnel.preview"`). The frontend shows it as a clickable badge in the header bar.

Preview tunnels are tracked per-session. When the tmux session ends or the backend detects the server stopped (port closed), it kills that tunnel subprocess.

---

## TunnelManager Implementation

### `backend/app/core/tunnel.py`

```python
class TunnelManager:
    def __init__(self):
        self.session_tunnel: subprocess.Popen | None = None
        self.session_url: str | None = None
        self.preview_tunnels: dict[int, subprocess.Popen] = {}  # port -> process
        self.preview_urls: dict[int, str] = {}  # port -> url

    async def start_session_tunnel(self, port: int = 8000) -> str:
        """Start the main ARC4DE tunnel. Returns the public URL."""

    async def stop_session_tunnel(self) -> None:
        """Stop the session tunnel (called on shutdown)."""

    async def start_preview_tunnel(self, port: int) -> str:
        """Start a tunnel for a dev server port. Returns URL."""

    async def stop_preview_tunnel(self, port: int) -> None:
        """Stop a specific preview tunnel."""

    async def stop_all_preview_tunnels(self) -> None:
        """Stop all preview tunnels (called on session end)."""
```

### URL Parsing

Cloudflared outputs the URL to stderr in the format:
```
INF +-----------------------------------------------------+
INF |  Your quick tunnel has been created! Visit it at:  |
INF |  https://random-words.trycloudflare.com            |
INF +-----------------------------------------------------+
```

We read stderr line-by-line until we match `https://.*\.trycloudflare\.com`, with a 10-second timeout. If parsing fails, we log an error but don't crash the backend - ARC4DE still works locally.

### Lifecycle

- `start_session_tunnel()` called in FastAPI lifespan `yield` block
- `stop_session_tunnel()` called after lifespan exits
- Preview tunnels tied to terminal sessions via session ID

---

## App Preview Detection

### Output Parser

The WebSocket terminal handler already processes all PTY output before sending to the frontend. We add a lightweight scanner that checks each chunk against detection patterns.

```python
# backend/app/core/tunnel.py

PREVIEW_PATTERNS = [
    r"listening on (?:port )?(\d+)",
    r"Local:\s+https?://(?:localhost|127\.0\.0\.1):(\d+)",
    r"ready on https?://(?:localhost|127\.0\.0\.1):(\d+)",
    r"started server on.*:(\d+)",
    r"Server running at https?://(?:localhost|127\.0\.0\.1):(\d+)",
    r"webpack.*compiled.*https?://localhost:(\d+)",
]

def detect_server_port(output: str) -> int | None:
    """Scan output for server start patterns. Returns port or None."""
```

### Debouncing

Dev servers often print multiple "listening" messages (HMR reconnects, etc.). We debounce by:
- Tracking which ports already have tunnels
- Ignoring duplicate detections for 5 seconds
- Only creating tunnel if port is actually open (quick TCP check)

### WebSocket Messages

When a preview tunnel is created:
```json
{
  "type": "tunnel.preview",
  "port": 3000,
  "url": "https://preview-xyz.trycloudflare.com"
}
```

When stopped:
```json
{
  "type": "tunnel.preview.closed",
  "port": 3000
}
```

### Scope

Preview tunnels are per terminal session. If user has two sessions, each manages its own preview tunnels. Session cleanup kills associated tunnels.

---

## Frontend UI

### Persistent Header Bar

A new `<TunnelBar />` component sits at the top of the main content area (below the sidebar header on desktop, below the top header on mobile). It's always visible when a tunnel URL exists.

```
┌─────────────────────────────────────────────────────────┐
│  🔗 https://abc-xyz.trycloudflare.com  [Copy] [QR]     │
│     Preview: :3000 [Open]  :5173 [Open]                │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- Session URL with copy button (copies to clipboard, shows "Copied!" toast)
- QR code button - opens modal with scannable QR code for mobile pairing
- Preview pills - each active preview port as a clickable badge that opens in new tab

### State Management

Add to Zustand store (or new `tunnelStore`):
```typescript
interface TunnelState {
  sessionUrl: string | null;
  previewUrls: Record<number, string>;  // port -> url
  fetchSessionUrl: () => Promise<void>;
  addPreview: (port: number, url: string) => void;
  removePreview: (port: number) => void;
}
```

### Data Flow

1. On app load, frontend calls `GET /api/tunnel` to get session URL
2. WebSocket handler listens for `tunnel.preview` messages
3. Store updates trigger TunnelBar re-render

### Mobile Considerations

On mobile, the bar is more compact - just shows a "🔗 Remote" badge that expands to full URL on tap. Preview pills scroll horizontally if multiple.

---

## Docker & Deployment

### Dockerfile Changes

Add cloudflared binary to the backend image:

```dockerfile
# backend/Dockerfile

FROM python:3.11-slim

# Install cloudflared
ARG TARGETARCH
RUN apt-get update && apt-get install -y curl \
    && curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${TARGETARCH} \
       -o /usr/local/bin/cloudflared \
    && chmod +x /usr/local/bin/cloudflared \
    && apt-get remove -y curl && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# ... rest of existing Dockerfile
```

### Configuration

New settings in `backend/app/config.py`:
```python
tunnel_enabled: bool = True  # Set False to disable tunneling
tunnel_port: int = 8000      # Port to tunnel (should match uvicorn)
```

Environment variable: `ARC4DE_TUNNEL_ENABLED=false` to disable for local-only use.

### API Endpoint

`GET /api/tunnel`:
```json
{
  "session_url": "https://abc.trycloudflare.com",
  "previews": [
    {"port": 3000, "url": "https://preview-xyz.trycloudflare.com"}
  ]
}
```

---

## Error Handling

### Cloudflared Not Found

If `cloudflared` binary isn't available (non-Docker local dev), log a warning and continue without tunneling. ARC4DE works fine locally - tunneling is optional.

```python
if shutil.which("cloudflared") is None:
    logger.warning("cloudflared not found - tunneling disabled")
    return None
```

### Tunnel Startup Failure

If cloudflared fails to start or URL parsing times out (10s):
- Log the error with stderr output
- Set `session_url = None`
- Frontend shows "Tunnel unavailable" instead of URL
- Backend continues running normally

### Tunnel Process Dies

Monitor the subprocess with a background task. If tunnel dies unexpectedly:
- Attempt restart (max 3 retries with exponential backoff)
- After 3 failures, give up and log error
- Frontend polls `/api/tunnel` periodically (every 30s) to detect recovery

### Port Conflicts

If cloudflared can't bind or the target port isn't responding:
- Preview tunnel fails silently (user sees no preview URL)
- Session tunnel retries on different random port (shouldn't happen normally)

### Graceful Shutdown

On SIGTERM/SIGINT:
1. Stop accepting new connections
2. `SIGTERM` to all tunnel subprocesses
3. Wait 5s for graceful exit
4. `SIGKILL` if still running
5. Exit backend

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `backend/app/core/tunnel.py` | Create - TunnelManager class |
| `backend/app/api/tunnel.py` | Create - API endpoint |
| `backend/app/main.py` | Modify - Lifespan hooks |
| `backend/app/ws/terminal.py` | Modify - Output parser |
| `backend/app/config.py` | Modify - Tunnel settings |
| `backend/Dockerfile` | Modify - Add cloudflared |
| `frontend/src/components/TunnelBar.tsx` | Create - Header bar |
| `frontend/src/stores/tunnelStore.ts` | Create - State management |
| `frontend/src/layouts/DesktopLayout.tsx` | Modify - Include TunnelBar |
| `frontend/src/layouts/MobileLayout.tsx` | Modify - Include TunnelBar |
| `frontend/src/layouts/TabletLayout.tsx` | Modify - Include TunnelBar |

---

## Success Criteria

- [ ] Backend starts tunnel automatically on startup
- [ ] Session URL displayed in UI with copy button
- [ ] QR code modal works for mobile pairing
- [ ] Dev server detection creates preview tunnels
- [ ] Preview URLs appear as clickable badges
- [ ] Tunnels cleaned up on shutdown
- [ ] Works in Docker deployment
- [ ] Graceful fallback when cloudflared unavailable
