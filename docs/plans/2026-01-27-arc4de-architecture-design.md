# ARC4DE Architecture Design

**Date:** 2026-01-27
**Status:** Approved
**Authors:** Jon + Claude (Brainstorming Session)

---

## 1. Tech Stack

### Frontend
- **React 18** + **TypeScript** + **Vite** + **TailwindCSS**
- **Zustand** for state management
- **@xterm/xterm** + **@xterm/addon-fit** + **@xterm/addon-webgl** for terminal rendering
- **React Router** for navigation
- **idb-keyval** for IndexedDB storage
- **Workbox** for PWA service worker generation
- **Native WebSocket API** (not Socket.IO - lighter, no polling fallback needed)

### Backend
- **Python 3.11+** with **FastAPI**
- **Starlette WebSockets** (native, not Socket.IO)
- **Pydantic v2** for settings and validation
- **python-jose** for JWT
- **uvicorn** as ASGI server
- **tmux** for persistent session management
- **asyncio** + PTY for subprocess streaming

### Infrastructure
- **Docker** + **docker-compose** for deployment
- **Cloudflare Tunnels** (ephemeral) as primary access method
- **SQLite** not required - no database for MVP (IndexedDB on frontend, env config on backend)

### Key Decision: No Socket.IO
The PRD mentioned `socket.io-client`. We're using native WebSocket API instead. Socket.IO adds a polling fallback and custom protocol we don't need - Cloudflare Tunnels support WebSockets natively, and the native API is simpler and lighter.

---

## 2. Terminal Engine: xterm.js + Mobile Addons

Building a custom terminal renderer that correctly handles VT100 escape sequences, cursor positioning, scrollback buffers, selection, and ANSI 256-color codes would be a multi-month effort. xterm.js already does all of this and is used by VS Code's integrated terminal.

**Approach:** Use xterm.js as the core everywhere, with a custom mobile interaction layer on top:
- Touch-optimized input bar (thumb-friendly, bottom of screen)
- Floating voice input button
- Swipe-up quick actions drawer
- Custom gesture handling (swipe for history, pinch-to-zoom text)

**Desktop enhancements:**
- WebGL addon for GPU-accelerated rendering
- Full keyboard shortcut support
- Multi-tab terminal views
- Copy/paste with system clipboard

---

## 3. Adaptive Layout Architecture

Three device classes with distinct layouts, detected via `useDeviceClass()` hook:

### Mobile (< 768px)
- Full-screen terminal with bottom input bar (thumb-friendly)
- Swipe-up drawer for quick actions
- Hamburger menu for server switching
- Floating voice input button (bottom-right)
- Single-pane only - one view at a time

### Tablet (768px - 1199px)
- Split-pane option: server list sidebar (collapsible) + terminal
- Quick actions bar along the bottom or side
- Larger touch targets with more visible context
- Optional split terminal (two sessions side by side in landscape)

### Desktop (1200px+)
- Persistent sidebar: server list + plugin selector
- Main area: terminal with full xterm.js + WebGL rendering
- Bottom/side panel: quick actions, command history
- Multi-tab terminal support (like VS Code terminal tabs)
- Keyboard shortcuts: Ctrl+K command palette, Ctrl+` toggle terminal, etc.

### Implementation
- `useDeviceClass()` hook returns `"mobile" | "tablet" | "desktop"` based on viewport width with resize listener
- Page-level layout components branch on device class
- Shared components (terminal, auth forms, server cards) adapt via props/CSS

### PWA Strategy
- Full offline shell (app loads without network, shows "connecting..." state)
- `manifest.json` with `display: "standalone"` for native-like install
- Workbox for precaching static assets
- App icon set for all platforms (iOS, Android, Windows, macOS)
- `theme-color` matching dark terminal aesthetic

---

## 4. WebSocket Protocol

Single WebSocket connection per server at `/ws/terminal`. JSON messages with strict type system:

### Client to Server
```json
{ "type": "auth", "token": "jwt..." }
{ "type": "input", "data": "ls -la\n" }
{ "type": "resize", "cols": 80, "rows": 24 }
{ "type": "plugin.activate", "plugin": "claude-code" }
{ "type": "ping" }
```

### Server to Client
```json
{ "type": "output", "data": "..." }
{ "type": "auth.ok", "plugins": [...], "sessions": [...] }
{ "type": "auth.fail", "reason": "..." }
{ "type": "event", "event": "file_created", "data": {...} }
{ "type": "error", "message": "..." }
{ "type": "pong" }
```

### Backend Session Model
Each WebSocket connection attaches to a tmux session via a PTY bridge using Python's `pty` module + `asyncio.create_subprocess_exec`. This gives true terminal emulation - cursor positioning, colors, interactive programs (vim, htop) all work correctly.

### Reconnection Strategy
- Client stores `session_id`
- On disconnect: exponential backoff reconnect (1s, 2s, 4s, 8s, max 30s)
- Server holds PTY alive for 60 seconds after disconnect
- If client reconnects within window: reattach to existing PTY, replay buffered output
- After 60s without reconnect: PTY detaches (but tmux session persists - see Section 5)

---

## 5. Persistent Sessions via tmux

tmux runs as backend infrastructure, fully abstracted from the user. The user never interacts with tmux directly - ARC4DE manages it.

### How It Works
1. User connects -> backend creates tmux session named `arc4de-{session_id}`
2. PTY attaches to that tmux session and streams output to WebSocket
3. User closes app -> WebSocket drops, PTY detaches, **tmux session keeps running**
4. Processes keep executing (long builds, Claude Code conversations, etc.)
5. User reopens app -> backend reattaches to existing tmux session
6. Client receives buffered output it missed (tmux captures scrollback)

### Session Lifecycle States
- **Active**: WebSocket connected, streaming live
- **Detached**: No WebSocket, tmux session alive, processes still running
- **Expired**: Detached longer than TTL (configurable, default 24h), auto-killed
- **Named sessions**: User can name sessions ("claude-project-x", "docker-logs") and switch between them

### API Endpoints
```
GET    /api/sessions           -> List all sessions (active + detached)
POST   /api/sessions           -> Create new named session
WS     /ws/session/{id}        -> Attach to specific session
DELETE /api/sessions/{id}      -> Kill a session
```

### Frontend Implications
- Session picker screen (between server list and terminal)
- Status badges: "running" (green), "detached" (yellow), "idle" (gray)
- "New Session" button + session naming
- Notification: "3 detached sessions on Production Server"
- On reconnect, prompt: "Resume session X?" or "Start new?"

### Why tmux (not custom)
- Survives backend restarts (tmux sessions persist independently)
- Handles interactive programs correctly across detach/reattach
- Scrollback buffer management already solved
- Multiple windows/panes per session (future: expose in UI)
- Zero effort on process lifecycle management
- Available in every Linux distro, included in Docker image

---

## 6. Plugin System Architecture

### Plugin Contract
```python
class Plugin(ABC):
    name: str                    # "claude-code"
    display_name: str            # "Claude Code"
    command: str                 # "claude" (the CLI binary)

    async def initialize(self) -> bool
    async def transform_input(self, raw: str) -> str
    async def parse_output(self, chunk: str) -> OutputChunk
    def get_quick_actions(self) -> list[QuickAction]
    def get_health(self) -> HealthStatus
```

### Plugin Lifecycle
1. Backend starts -> scans `app/plugins/` and `plugins-community/`
2. Each valid plugin is loaded and `initialize()` called (verifies CLI exists)
3. Plugin registry reported to frontend on auth
4. User activates plugin -> tmux session runs plugin's CLI
5. Input routed through `transform_input()`, output through `parse_output()`
6. Quick actions surfaced in UI based on active plugin

### tmux Integration
When a user activates a plugin, the tmux session runs that plugin's CLI instead of raw bash. For Claude Code: `claude --interactive`. For raw terminal: `bash`. Switching plugins creates a new tmux window within the same session (tmux handles multi-window natively).

### Claude Code Reference Plugin
- Spawns `claude` CLI process
- Detects tool use blocks vs chat output
- Surfaces file-change events
- Quick actions: "new conversation", "continue last", "show plan", "run tests"
- Proves the plugin contract, becomes template for community plugins

### Plugin Discovery
- `app/plugins/` - Built-in plugins (shipped with ARC4DE)
- `plugins-community/` - User-installed plugins (volume-mounted in Docker)
- Each directory with a valid `plugin.py` implementing `Plugin` ABC is loaded

---

## 7. Security & Authentication

### Auth Model
Single-user per backend instance (MVP). Server owner sets a password/API key in environment config. No user database, no registration flow.

### Login Flow
1. User enters server URL + password in app
2. `POST /api/auth/login` with password -> returns access token (15 min) + refresh token (7 days)
3. Tokens stored encrypted in IndexedDB (Web Crypto API with device-derived key)
4. Access token sent as first WebSocket message on connect (not query param - avoids logging tokens)
5. Background refresh before expiry - seamless to user
6. Refresh token rotation: each refresh invalidates the old refresh token

### QR Code Pairing (Cloudflare Tunnel)
1. Backend starts -> creates ephemeral Cloudflare tunnel -> gets public URL
2. Generates one-time pairing token
3. Encodes into QR: `{ url, pairingToken, serverName }`
4. Displays QR in terminal (Unicode block-character rendering)
5. User scans -> app calls `POST /api/auth/pair` with pairing token
6. Server validates (one-time use), returns JWT pair
7. Server saved in app automatically

### Transport Security
- HTTPS/WSS via Cloudflare Tunnel (automatic)
- CORS locked to configured origins
- Rate limiting: 5 login attempts per minute, then 15-minute lockout
- CSP headers, X-Frame-Options, HSTS

### Command Audit Log
- Every command logged with timestamp, session ID, plugin context
- Rotating log file (not database)
- Configurable retention (default 7 days, or disabled)
- No PII beyond the commands themselves

### NOT in MVP
- Multi-user / RBAC (Phase 2+)
- E2E encryption (Phase 2+)
- IP whitelisting
- Certificate pinning

---

## 8. Project Structure

```
arc4de/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app, CORS, mount routes
│   │   ├── config.py               # Pydantic settings from env
│   │   ├── api/
│   │   │   ├── auth.py             # login, refresh, pair, logout
│   │   │   ├── sessions.py         # list, create, delete tmux sessions
│   │   │   └── plugins.py          # list available plugins, health
│   │   ├── ws/
│   │   │   └── terminal.py         # WebSocket handler, PTY <-> tmux bridge
│   │   ├── core/
│   │   │   ├── tmux.py             # tmux session management wrapper
│   │   │   ├── auth.py             # JWT create/verify/refresh logic
│   │   │   └── audit.py            # Command audit logging
│   │   └── plugins/
│   │       ├── base.py             # Plugin ABC + QuickAction model
│   │       ├── manager.py          # Discovery, loading, registry
│   │       └── claude_code/
│   │           ├── __init__.py
│   │           └── plugin.py       # Claude Code reference plugin
│   ├── plugins-community/          # External plugin mount point
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── layouts/
│   │   │   ├── MobileLayout.tsx
│   │   │   ├── TabletLayout.tsx
│   │   │   └── DesktopLayout.tsx
│   │   ├── components/
│   │   │   ├── terminal/
│   │   │   │   ├── Terminal.tsx         # xterm.js wrapper
│   │   │   │   ├── MobileInputBar.tsx   # Thumb-friendly input
│   │   │   │   ├── QuickActionsDrawer.tsx
│   │   │   │   └── SessionPicker.tsx
│   │   │   ├── server/
│   │   │   │   ├── ServerList.tsx
│   │   │   │   ├── ServerCard.tsx
│   │   │   │   └── QRScanner.tsx
│   │   │   └── auth/
│   │   │       └── LoginForm.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useTerminal.ts
│   │   │   ├── useAuth.ts
│   │   │   ├── useDeviceClass.ts
│   │   │   └── useSessions.ts
│   │   ├── stores/
│   │   │   ├── serverStore.ts
│   │   │   ├── terminalStore.ts
│   │   │   ├── authStore.ts
│   │   │   └── sessionStore.ts
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   ├── websocket.ts
│   │   │   └── storage.ts          # idb-keyval wrapper
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── styles/
│   │       └── global.css
│   ├── public/
│   │   ├── manifest.json
│   │   └── icons/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## 9. Build Phases

Implementation order, each phase producing a working increment:

### Phase 1: Skeleton
- Project scaffolding, all config files, Docker setup
- Git init, .gitignore, .env.example
- Backend: FastAPI app with health endpoint
- Frontend: React + Vite + Tailwind shell with PWA manifest
- **Deliverable:** `docker-compose up` serves empty app

### Phase 2: Backend Core
- FastAPI app with CORS, route mounting
- Pydantic config from environment
- Health check endpoint
- **Deliverable:** Backend responds to API requests

### Phase 3: Authentication
- JWT create/verify/refresh logic
- Login endpoint (env-based password)
- Auth middleware for protected routes
- **Deliverable:** Can authenticate and receive tokens

### Phase 4: tmux Integration
- tmux wrapper: create, attach, detach, list, kill sessions
- Session lifecycle management (TTL, auto-cleanup)
- **Deliverable:** Backend can manage tmux sessions programmatically

### Phase 5: WebSocket Terminal
- PTY <-> tmux <-> WebSocket bridge
- Auth via first message
- Reconnection with PTY reattach
- Terminal resize support
- **Deliverable:** Can execute commands via WebSocket and see streaming output

### Phase 6: Frontend Shell
- React Router setup (server list -> login -> session picker -> terminal)
- Adaptive layout system with `useDeviceClass()`
- Three layout components (Mobile, Tablet, Desktop)
- **Deliverable:** App navigates between views, adapts to device

### Phase 7: Terminal UI
- xterm.js integration with fit + webgl addons
- Mobile input bar (MobileInputBar.tsx)
- Terminal resize handling per device class
- Copy/paste, scrollback
- **Deliverable:** Full terminal experience on all devices

### Phase 8: Server Management
- Add/edit/remove servers in UI
- IndexedDB storage via idb-keyval
- Connection flow (select server -> login -> connect)
- Connection status indicators
- **Deliverable:** Multi-server management working end-to-end

### Phase 9: Session Management
- Session picker UI
- Create/resume/kill sessions from frontend
- Status badges (running, detached, idle)
- Resume prompt on reconnect
- **Deliverable:** Persistent sessions working end-to-end

### Phase 10: Plugin System
- Plugin base class, manager, discovery
- Claude Code reference plugin
- Plugin activation via WebSocket message
- Plugin health reporting
- **Deliverable:** Claude Code controllable from app

### Phase 11: Quick Actions
- Plugin-driven quick action bar
- Swipe-up drawer on mobile, side panel on desktop
- Context-aware actions per active plugin
- **Deliverable:** One-tap shortcuts for common commands

### Phase 12: QR Code Pairing
- Backend: Cloudflare tunnel creation, QR generation
- Frontend: QR scanner component
- One-time pairing token flow
- **Deliverable:** Scan-to-connect working

### Phase 13: Polish
- Audit logging
- Error handling and edge cases
- PWA icons and splash screens
- Offline shell (loading state without network)
- Performance optimization (virtual scrolling, lazy loading)
- **Deliverable:** Production-ready v1.0

---

## 10. Open Questions (Deferred to Phase 2+)

1. **E2E Encryption**: Key exchange protocol for relay mode
2. **Multi-user / RBAC**: User database, roles, permissions
3. **Plugin Marketplace**: In-app discovery and installation
4. **Voice Input**: Speech-to-text integration and voice-to-action
5. **Relay Server**: Alternative to direct WebSocket for NAT traversal
6. **Plugin Isolation**: Separate processes for security/stability
7. **Desktop App**: Electron wrapper sharing same frontend
