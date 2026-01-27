# PRD: ARC4DE (Automated Remote Control for Distributed Environments)

## Overview

ARC4DE is a progressive web application that provides secure mobile access to CLI-based services running on remote servers. Using a plugin architecture, users can control any command-line tool from their phone - starting with Claude Code as the flagship integration, then expanding to AWS CLI, Docker, Kubernetes, GitHub CLI, and beyond. The core value is: install ARC4DE backend on your server, point the PWA at it, and control your entire server infrastructure from your phone.

**Name:** ARC4DE (Automated Remote Control for Distributed Environments)
- Pronounce: "Arcade" 
- Emphasizes: automation, remote control, distributed systems
- Flexible: works for dev, ops, infrastructure, data, etc.

## Vision

Any CLI tool should be controllable from mobile with the same quality as desktop, through a unified interface that adapts to each tool's unique capabilities while maintaining consistent UX patterns.

## Goals

**Primary:**
- Provide terminal-like mobile interface with streaming I/O
- Enable voice and text input for remote command execution
- Support multiple servers and multiple services per server
- Plugin architecture for adding new CLI tools without core changes
- Secure for public-facing deployment (proxy-friendly)

**Secondary:**
- Match quality of native CLI experience (syntax highlighting, autocomplete, history)
- Context-aware quick actions per service
- Service-specific UI enhancements (beyond raw terminal)
- Session persistence and history
- Community-contributed plugins

## Non-Goals

- Replace SSH clients for general server administration
- Provide GUI alternatives for services with existing web UIs
- Support non-CLI services (databases, APIs without CLI wrappers)
- Offline functionality (requires live server connection)
- Desktop/tablet optimization (mobile-first only for v1)

## Core Principles

1. **Terminal First**: The terminal interface is the foundation - everything else is enhancement
2. **Progressive Enhancement**: Raw terminal → Quick actions → Custom UI per service
3. **Plugin Everything**: New services should be addable without touching core code
4. **Security By Default**: Public-facing requires authentication, encryption, rate limiting
5. **Mobile Native Feel**: Not a desktop terminal crammed into mobile - designed for touch/voice

## User Personas

**Primary: Jon (DevOps Engineer)**
- Manages multiple remote dev/staging/prod servers
- Uses Claude Code, AWS CLI, gh CLI, Docker, kubectl daily
- Away from desk frequently, needs mobile access
- Security-conscious, prefers self-hosted solutions
- Wants to prototype new tool integrations quickly

**Secondary: Platform Engineer**
- Manages Kubernetes clusters, cloud infrastructure
- Needs quick access to kubectl, aws, terraform, helm
- Wants to respond to alerts/incidents from phone
- Values command history and reusable command templates

**Tertiary: AI Developer**
- Primary use is Claude Code for development
- Occasionally needs git, npm, python CLI access
- Less technical than DevOps users, wants simplified interface
- May contribute plugins for AI-specific tools (ollama, huggingface-cli)

## MVP Feature Set (Phase 1: Foundation)

### 1. Core Terminal Interface

**Priority: P0 (Must Have for Launch)**

**Terminal Emulation:**
- Full-screen terminal view (primary screen)
- Text input field (bottom, mobile keyboard friendly)
- Voice input button (speech-to-text)
- Output area with scrollback buffer
- Support for ANSI color codes
- Monospace font, syntax highlighting for common patterns

**Input Methods:**
- Text input (standard textarea, auto-expanding)
- Voice input with visual feedback
- Show transcription before sending
- Edit transcription before submit
- Command history (up/down arrows or swipe)

**Output Handling:**
- Real-time streaming (WebSocket)
- Preserve formatting (ANSI codes)
- Auto-scroll to bottom (with manual scroll override)
- Tap to select/copy text
- Long-press for context menu (copy, search, share)

**Session Management:**
- Start new session
- Resume session (if terminal supports it)
- Clear screen
- Session timeout handling
- Reconnect on WebSocket drop

**Success Criteria:**
- Can execute arbitrary commands and see output in <200ms latency
- Voice input transcription accuracy >85%
- Output renders correctly for 95% of common CLI tools
- Zero command/output loss during reconnection

### 2. Multi-Server Support

**Priority: P0**

**Server Management:**
- Add server (FQDN/IP, port, label)
- Edit/delete servers
- Connection status indicator per server
- Quick-switch between servers (dropdown or slide-up sheet)
- Store configs in IndexedDB (encrypted)

**Server Configuration Schema:**
```json
{
  "id": "uuid",
  "name": "Production Server",
  "host": "server.example.com",
  "port": 3000,
  "authToken": "encrypted_jwt",
  "status": "connected|disconnected|error",
  "lastConnected": "timestamp"
}
```

**UI Flow:**
1. User opens app → sees server list
2. Taps server → connects via WebSocket
3. Sees terminal interface for that server
4. Can switch servers without losing session state

**Success Criteria:**
- Manage 10+ servers without performance degradation
- Switch servers in <1 second
- Clear visual indication of which server is active
- No accidental command execution on wrong server

### 3. Authentication & Security

**Priority: P0**

**Authentication:**
- Login screen (server URL + credentials)
- JWT-based authentication
- Token stored securely (IndexedDB, encrypted)
- Token refresh mechanism
- Auto-logout on token expiry
- Logout button (clears tokens)

**Authorization:**
- Per-server tokens (not shared across servers)
- Rate limiting (backend enforced)
- Command auditing (log all executed commands)

**Transport Security:**
- WSS (WebSocket Secure) required
- HTTPS for all HTTP endpoints
- CORS configured for known origins
- Support Cloudflare Tunnel deployment
- Optional IP whitelist (backend config)

**Security Headers:**
- Content-Security-Policy
- X-Frame-Options
- Strict-Transport-Security

**Success Criteria:**
- Pass OWASP security checklist
- No plain-text credential storage
- All traffic encrypted in transit
- Audit logs capture all commands with timestamps

### 4. Basic Plugin System (Claude Code)

**Priority: P1 (Nice to Have for Launch)**

**Plugin Architecture:**

Each plugin is a Python module that implements standard interface:

```python
class Plugin:
    name: str  # "claude-code"
    display_name: str  # "Claude Code"
    
    def initialize(self) -> None:
        """Setup plugin (verify CLI exists, etc.)"""
    
    def execute(self, command: str) -> AsyncIterator[str]:
        """Execute command, yield output chunks"""
    
    def get_quick_actions(self) -> List[QuickAction]:
        """Return context-aware quick action buttons"""
    
    def parse_output(self, output: str) -> ParsedOutput:
        """Optional: Parse output for enhanced rendering"""
```

**Claude Code Plugin (Reference Implementation):**
- Spawns `claude` CLI subprocess
- Streams stdin/stdout
- Parses output to detect:
  - Chat messages vs tool usage
  - File creations/modifications
  - Interactive prompts (AskUserQuestion)
- Provides quick actions:
  - "New conversation"
  - "Continue last"
  - "Show plan"
  - "Execute plan"

**Plugin Discovery:**
- Plugins installed in `/plugins` directory
- Auto-discovered on backend startup
- Each plugin registers itself with core
- Frontend queries available plugins on connect

**Plugin UI Integration:**
- Terminal shows plugin output (raw or enhanced)
- Quick action bar shows plugin-specific buttons
- Plugin can request custom UI components (future)

**Success Criteria:**
- Claude Code plugin works identically to desktop Claude Code
- Adding new plugin requires <100 lines of code
- Plugin crash doesn't crash backend
- Can run multiple plugins simultaneously (if needed)

## Post-MVP Features (Phase 2+)

### 5. Quick Actions

**Priority: P1**

**Global Quick Actions:**
- Command history (recent commands)
- Favorites (saved commands)
- Server info (uptime, resources)
- Reconnect

**Plugin-Specific Actions:**

*Claude Code:*
- "Start new conversation"
- "Review files changed"
- "Run tests"
- "Deploy app"

*GitHub CLI:*
- "Create issue"
- "List PRs"
- "Clone repo"
- "Checkout branch"

*AWS CLI:*
- "List EC2 instances"
- "Check S3 buckets"
- "View CloudWatch logs"
- "Describe stack"

*Docker:*
- "List containers"
- "View logs"
- "Restart container"
- "Pull image"

**Implementation:**
- Bottom sheet or side drawer
- Context-aware (changes based on active plugin)
- Tap action → command auto-inserted (optionally auto-executed)
- Can customize/reorder actions

### 6. Enhanced Output Rendering

**Priority: P2**

**Syntax Highlighting:**
- JSON (collapsed/expanded)
- YAML
- Code blocks (language detection)
- Log levels (color-coded)
- Errors/warnings highlighted

**Interactive Elements:**
- Clickable URLs (open in browser)
- File paths (tap to view file)
- Git commits (tap for details)
- Docker container IDs (tap for logs/inspect)

**Structured Output:**
- Table rendering for tabular data
- Tree view for hierarchical data
- Charts for metrics (if plugin provides)

### 7. Service-Specific Enhancements

**Priority: P2**

**Claude Code:**
- File diff viewer (side-by-side or unified)
- Artifact renderer (HTML, React previews)
- Plan mode visualization
- Conversation branching

**GitHub CLI:**
- Issue/PR cards (rich formatting)
- Inline code review
- Merge conflict resolution UI
- Branch visualizer

**Docker:**
- Container status cards
- Resource usage graphs
- Log filtering/searching
- Quick exec into container

**AWS CLI:**
- Resource topology view
- Cost calculator
- Region switcher
- CloudWatch dashboard

### 8. Customization & Settings

**Priority: P2**

**Terminal Preferences:**
- Font size
- Color scheme (dark/light/custom)
- Scrollback buffer size
- Auto-scroll behavior
- Cursor style

**Plugin Preferences:**
- Enable/disable plugins
- Plugin-specific settings
- Default plugin on connect
- Plugin update notifications

**Quick Action Customization:**
- Add custom commands
- Reorder actions
- Create action groups
- Import/export action sets

### 9. Collaboration Features

**Priority: P3 (Future)**

**Session Sharing:**
- Share read-only terminal view
- Collaborative sessions (multiple users, one terminal)
- Session recording/replay

**Team Features:**
- Shared server configurations
- Team command libraries
- Role-based access (admin, dev, viewer)

## Architecture (Revised for Plugins)

### Backend (FastAPI)

**Tech Stack:**
- Python 3.11+
- FastAPI
- WebSockets
- asyncio
- pydantic
- JWT for auth
- Plugin system (dynamic imports)

**Project Structure:**
```
/arc4de-backend
  /app
    /api
      /routes
        auth.py          # Login, token refresh
        servers.py       # Server info, health
        plugins.py       # List plugins, plugin config
      /websocket
        terminal.py      # WebSocket handler
    /core
      /terminal
        session.py       # Terminal session management
        executor.py      # Command execution
      /plugins
        base.py          # Plugin base class
        manager.py       # Plugin discovery, lifecycle
    /plugins             # Plugin directory
      /claude_code
        __init__.py
        plugin.py        # ClaudeCodePlugin class
      /github_cli
        plugin.py
      /aws_cli
        plugin.py
    /models
      user.py
      server.py
      plugin.py
    /security
      auth.py
      tokens.py
    main.py
    config.py
  /plugins-community     # User-contributed plugins
  requirements.txt
  Dockerfile
```

**WebSocket Protocol:**

```json
// Client → Server
{
  "type": "command",
  "plugin": "claude-code",  // optional, default terminal
  "data": "create a login form"
}

// Server → Client (streaming)
{
  "type": "output",
  "plugin": "claude-code",
  "data": "I'll create a login form...",
  "metadata": {
    "tool_use": false,
    "file_modified": null
  }
}

// Server → Client (metadata)
{
  "type": "event",
  "plugin": "claude-code",
  "event": "file_created",
  "data": {
    "path": "/src/components/Login.tsx",
    "size": 1024
  }
}
```

**Plugin Manager:**
- Discovers plugins in `/plugins` directory
- Validates plugin interface
- Loads plugins on demand
- Handles plugin errors gracefully
- Provides plugin lifecycle hooks (init, cleanup)

**Terminal Session:**
- One session per WebSocket connection
- Can spawn multiple plugin instances
- Routes commands to appropriate plugin
- Aggregates output from multiple sources

### Frontend (PWA)

**Tech Stack:**
- React 18+
- TypeScript
- Vite
- TailwindCSS
- Zustand (state management)
- Socket.io-client
- xterm.js (terminal emulator) OR custom component

**Project Structure:**
```
/arc4de-pwa
  /src
    /components
      /terminal
        Terminal.tsx         # Main terminal component
        Input.tsx           # Text + voice input
        Output.tsx          # Rendered output
        QuickActions.tsx    # Plugin quick actions
      /server
        ServerList.tsx
        ServerConfig.tsx
        ConnectionStatus.tsx
      /auth
        Login.tsx
        TokenManager.tsx
    /hooks
      useWebSocket.ts       # WebSocket connection
      useTerminal.ts        # Terminal state
      useVoiceInput.ts      # Speech-to-text
      usePlugins.ts         # Plugin management
    /store
      serverStore.ts
      terminalStore.ts
      authStore.ts
      pluginStore.ts
    /services
      api.ts
      websocket.ts
    /types
      plugin.ts
      server.ts
      terminal.ts
    App.tsx
    main.tsx
  /public
    manifest.json
    service-worker.js
  index.html
  vite.config.ts
  tailwind.config.js
```

**State Management:**

```typescript
// Terminal Store
interface TerminalState {
  output: OutputLine[]
  input: string
  history: string[]
  historyIndex: number
  activePlugin: string | null
  
  appendOutput: (line: OutputLine) => void
  setInput: (text: string) => void
  sendCommand: () => void
  navigateHistory: (direction: 'up' | 'down') => void
}

// Server Store
interface ServerState {
  servers: Server[]
  activeServer: string | null
  
  addServer: (server: Server) => void
  removeServer: (id: string) => void
  setActive: (id: string) => void
  updateStatus: (id: string, status: ConnectionStatus) => void
}

// Plugin Store
interface PluginState {
  available: Plugin[]
  active: Plugin | null
  
  loadPlugins: () => Promise<void>
  setActive: (name: string) => void
  getQuickActions: () => QuickAction[]
}
```

### Deployment

**Backend (Docker):**

```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Cloudflare tunnel (cloudflared)
RUN curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && \
    dpkg -i cloudflared.deb && \
    rm cloudflared.deb

# Install Claude Code CLI
RUN curl -fsSL https://claude.ai/install.sh | sh

# Copy application
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose port
EXPOSE 3000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3000"]
```

**Docker Compose:**

```yaml
services:
  arc4de:
    build: ./backend
    ports:
      - "3000:3000"
    volumes:
      - ./plugins-community:/app/plugins-community
      - ./data:/app/data
      - ./logs:/app/logs
      - ~/.cloudflared:/root/.cloudflared  # Cloudflare tunnel config
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - CLOUDFLARE_TUNNEL_ENABLED=true  # Auto-create ephemeral tunnel
    restart: unless-stopped
```

**Frontend (Static):**
- Build: `npm run build`
- Deploy to: Cloudflare Pages, Netlify, or serve from FastAPI
- Configure WebSocket endpoint in env

**Deployment Options (Priority Order):**

**Option 1: Ephemeral Cloudflare Tunnel (Recommended - Inspired by Happy Coder)**
```bash
# Backend automatically creates tunnel on startup
# No manual configuration needed
# Generates QR code with tunnel URL + connection credentials
# Free tier, encrypted, no port forwarding required

# User flow:
# 1. Start ARC4DE backend
# 2. Backend displays QR code in terminal
# 3. Scan QR code with mobile app
# 4. Instantly connected via Cloudflare tunnel
```

**Benefits:**
- Zero network configuration (works behind NAT, firewalls)
- Free Cloudflare encryption
- No static IP or domain required
- Automatically handles HTTPS/WSS certificates
- Tunnels are ephemeral (created per session, no persistence)

**Implementation:**
```python
# Backend startup creates ephemeral tunnel
import subprocess

def create_ephemeral_tunnel(port: int = 3000):
    """Create Cloudflare quick tunnel and return public URL"""
    result = subprocess.run(
        ["cloudflared", "tunnel", "--url", f"http://localhost:{port}"],
        capture_output=True,
        text=True
    )
    # Parse tunnel URL from output
    # Generate QR code with URL + JWT token
    # Display in terminal for mobile scanning
```

**Option 2: Persistent Cloudflare Tunnel (For Production)**
```bash
# One-time setup
cloudflared tunnel login
cloudflared tunnel create arc4de
cloudflared tunnel route dns arc4de arc4de.yourdomain.com

# Config file: ~/.cloudflared/config.yml
tunnel: <tunnel-id>
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: arc4de.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404

# Run tunnel
cloudflared tunnel run arc4de
```

**Option 3: VPN-Only Access (Maximum Security)**
- Deploy on private network
- Require Tailscale/Wireguard/ZeroTier VPN
- No public exposure
- Recommended for sensitive environments

**Option 4: Traditional Reverse Proxy (nginx/Caddy)**
```nginx
# nginx config
server {
    listen 443 ssl;
    server_name arc4de.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## User Flows

### First-Time Setup (QR Code Pairing - Inspired by Happy Coder)

**Primary Flow (Cloudflare Tunnel + QR Code):**

1. User installs ARC4DE backend on server
2. Runs: `docker-compose up` or `arc4de start`
3. Backend starts and automatically:
   - Creates ephemeral Cloudflare tunnel
   - Generates connection credentials (JWT secret)
   - Displays QR code in terminal containing:
     - Tunnel URL (e.g., `https://random-tunnel-id.trycloudflare.com`)
     - Connection token (encrypted)
     - Server metadata (name, capabilities)
4. User opens ARC4DE PWA on mobile
5. Taps "Add Server" → "Scan QR Code"
6. Scans QR code displayed in terminal
7. App automatically configures server connection
8. User sees terminal interface, ready to use
9. Backend terminal shows: "Mobile device connected: [Device Name]"

**Benefits of QR Flow:**
- Zero manual typing (no URLs, tokens, ports)
- Instant setup (<30 seconds)
- No network configuration required
- Works behind any firewall/NAT
- Encrypted by default

**Alternative Flow (Manual Entry):**

1. User navigates to PWA URL (e.g., `arc4de.yourdomain.com`)
2. Sees "Add Server" screen
3. Enters:
   - Server URL: `https://server.example.com`
   - Port: `3000` (or custom)
   - Authentication: token or username/password
4. Taps "Connect"
5. Backend validates, issues JWT
6. User sees terminal interface with prompt
7. Can immediately start typing commands

### First-Time Setup (Old Flow - Manual)

1. User navigates to PWA URL (e.g., `arc4de.yourdomain.com`)
2. Sees "Add Server" screen
3. Enters:
   - Server URL: `https://server.example.com`
   - Port: `3000` (or custom)
   - Authentication: token or username/password
4. Taps "Connect"
5. Backend validates, issues JWT
6. User sees terminal interface with prompt
7. Can immediately start typing commands

### Using Claude Code (Primary Use Case)

1. User opens ARC4DE, connects to server
2. Terminal shows: `arc4de@server:~$`
3. User taps microphone, says: "Claude, create a login form with email and password"
4. Speech transcribed, shown in input field
5. User reviews, taps "Send" (or auto-sends)
6. Command sent to backend: `claude "create a login form with email and password"`
7. Claude Code responds, output streams back in real-time
8. User sees Claude's response with syntax highlighting
9. Claude creates file, user gets notification: "Created: /src/Login.tsx"
10. User taps notification, sees file diff
11. User approves or asks Claude to modify

### Switching Between Services

1. User currently in Claude Code session
2. Swipes down to reveal quick actions
3. Sees "Switch Plugin" option
4. Taps "GitHub CLI"
5. Terminal switches context
6. User types: `gh issue list`
7. Sees list of GitHub issues
8. Taps "Create Issue" quick action
9. Template pre-fills: `gh issue create --title "" --body ""`
10. User fills in details, submits

### Adding New Server

1. User taps hamburger menu (or server name in header)
2. Sees current server + "Add Server" button
3. Taps "Add Server"
4. Fills form (name, URL, port, token)
5. Taps "Save"
6. Server appears in list
7. User can switch to it anytime

## Plugin Development Guide

### Creating a Plugin

**1. Create Plugin Directory:**
```bash
mkdir -p plugins/my_tool
touch plugins/my_tool/__init__.py
touch plugins/my_tool/plugin.py
```

**2. Implement Plugin Class:**

```python
from app.core.plugins.base import Plugin, QuickAction
from typing import AsyncIterator

class MyToolPlugin(Plugin):
    name = "my-tool"
    display_name = "My Tool"
    
    async def initialize(self) -> None:
        # Verify CLI exists
        result = await self.run_command("which my-tool")
        if result.returncode != 0:
            raise PluginError("my-tool CLI not found")
    
    async def execute(self, command: str) -> AsyncIterator[str]:
        # Execute command via CLI
        async for chunk in self.stream_command(f"my-tool {command}"):
            yield chunk
    
    def get_quick_actions(self) -> list[QuickAction]:
        return [
            QuickAction(
                label="Status",
                command="status",
                icon="info"
            ),
            QuickAction(
                label="Deploy",
                command="deploy --prod",
                icon="rocket"
            )
        ]
```

**3. Register Plugin:**

```python
# plugins/my_tool/__init__.py
from .plugin import MyToolPlugin

__all__ = ["MyToolPlugin"]
```

**4. Test Plugin:**
```bash
pytest tests/plugins/test_my_tool.py
```

**5. Documentation:**
Create `plugins/my_tool/README.md` with:
- Installation instructions
- Configuration options
- Available commands
- Quick actions

### Plugin API Reference

**Base Class Methods:**

```python
class Plugin:
    async def run_command(cmd: str) -> CompletedProcess
    async def stream_command(cmd: str) -> AsyncIterator[str]
    def emit_event(event: str, data: dict) -> None
    def get_config(key: str) -> Any
```

**Events:**
- `file_created(path, size)`
- `file_modified(path, diff)`
- `process_started(pid, command)`
- `process_exited(pid, code)`
- Custom events (plugin-defined)

## Success Metrics

### MVP (Phase 1)

**Technical:**
- Terminal latency <200ms (p95)
- WebSocket uptime >99.5%
- Zero command loss during reconnections
- Support 10+ concurrent connections per server
- Plugin load time <100ms

**UX:**
- Can complete full Claude Code workflow on mobile
- Voice input works in 90% of quiet environments
- Zero learning curve for existing CLI users
- Positive feedback from 5 beta testers

**Security:**
- Pass penetration test
- No credential leaks in logs
- All traffic encrypted
- Audit log captures 100% of commands

### Post-MVP (Phase 2+)

**Adoption:**
- 10+ community-contributed plugins
- 100+ active users
- 5+ custom deployments (beyond creator)

**Performance:**
- Support 100+ servers per user
- Handle 1000+ commands/day per server
- Plugin ecosystem with 20+ tools

## Competitive Analysis & Architectural Inspiration

### Happy Coder - Primary Reference Architecture

**What Happy Coder Does Well:**

Happy Coder is an open-source mobile client specifically for Claude Code that demonstrates several architectural patterns we should adopt:

**1. Ephemeral Cloudflare Tunnels**
- Uses free Cloudflare tunnels for encrypted public access
- No need for port forwarding, VPN setup, or static IPs
- Tunnels are created on-demand when CLI starts
- Eliminates the complexity of exposing servers publicly
- **ARC4DE Adoption**: Make Cloudflare tunnel the default/recommended deployment method

**2. QR Code Pairing**
- Terminal displays QR code containing connection credentials + encryption key
- Mobile app scans QR code for instant pairing
- No manual URL/token entry required
- **ARC4DE Adoption**: Implement QR-based server addition as primary flow

**3. End-to-End Encryption Architecture**
- Only CLI and mobile app have decryption keys
- Relay server handles opaque encrypted blobs
- Zero-knowledge architecture for relay infrastructure
- **ARC4DE Adoption**: Implement similar E2E encryption for sensitive environments

**4. Relay Server Pattern**
- Decouples client from server networking
- Enables bidirectional real-time sync
- Handles connection state/reconnection
- **ARC4DE Adoption**: Consider relay option as alternative to direct WebSocket

**5. Voice-to-Action (Not Just Transcription)**
- Voice input is processed for intent, not just converted to text
- Context-aware command interpretation
- **ARC4DE Adoption**: Enhance voice input with intent recognition per plugin

**6. Multi-Session Support**
- Launch multiple CLI instances in different directories
- Each gets unique session
- Mobile app switches between sessions
- **ARC4DE Adoption**: Support multiple concurrent plugin sessions

**7. Web Interface Alternative**
- Provides local web UI (http://localhost:8080) in addition to mobile
- Works on any device on same network
- **ARC4DE Adoption**: Serve PWA from backend server directly as option

**What ARC4DE Does Better:**

- **Plugin Architecture**: Happy Coder is Claude Code only; ARC4DE supports any CLI tool
- **Progressive Enhancement**: Terminal → Quick Actions → Custom UI per service
- **Multi-Server Management**: Happy Coder is single-server; ARC4DE manages multiple servers
- **Service-Specific Intelligence**: Plugin-aware quick actions and custom rendering
- **Open Plugin Ecosystem**: Community can add plugins; Happy Coder is closed-loop

### Happy Coder Analysis Action Items

**Phase 0: Research & Analysis (Before Development)**

1. **Architecture Deep Dive**
   - [ ] Study Happy Coder's relay server implementation
   - [ ] Analyze their WebSocket protocol and message format
   - [ ] Review their E2E encryption scheme (key exchange, cipher choice)
   - [ ] Understand their Cloudflare tunnel integration
   - [ ] Examine session management and reconnection logic

2. **UI/UX Analysis**
   - [ ] Download and test Happy Coder mobile app (iOS/Android)
   - [ ] Document user flows (pairing, session switching, voice input)
   - [ ] Screenshot key screens for reference
   - [ ] Identify UX patterns that work well on mobile
   - [ ] Note pain points or areas for improvement

3. **Infrastructure Study**
   - [ ] Test their CLI tool installation and setup
   - [ ] Monitor network traffic to understand relay communication
   - [ ] Examine how they handle multiple concurrent sessions
   - [ ] Document their QR code pairing protocol
   - [ ] Test failure modes (network drop, server restart, etc.)

4. **Code Review**
   - [ ] Review Happy Coder's open source repository
   - [ ] Identify reusable patterns or libraries
   - [ ] Study their plugin-like architecture for Claude Code integration
   - [ ] Examine mobile app architecture (if source available)
   - [ ] Document any anti-patterns to avoid

**Adoption Strategy:**

**Immediate (MVP Phase 1):**
- Cloudflare tunnel as primary deployment option
- QR code pairing for server addition
- Basic relay server pattern (if beneficial for NAT traversal)

**Near-term (Phase 2):**
- End-to-end encryption for relay mode
- Multi-session support within single server
- Web interface served from backend

**Future (Phase 3+):**
- Voice-to-action intent recognition
- Advanced relay features (session persistence, etc.)
- Mobile-optimized UI patterns from Happy Coder

### Other Competitive Tools

**Termius (Commercial SSH Client)**
- Recently added speech-to-text (Dec 2024)
- Added special input field for "CLI coding agents"
- Multi-platform, polished UX
- Subscription: $10-15/month
- **Gap**: No plugin system, generic SSH only, no service-specific features
- **Learning**: Voice input timing suggests market demand

**Pocket Server/Pocket Agent**
- Turns laptop into backend for mobile coding
- WebSocket-based architecture
- Multi-tab terminal, file editing
- **Gap**: General terminal, not CLI tool orchestration
- **Learning**: Desktop-to-mobile pattern, session management

**SSH Button Widgets (Android)**
- Quick command shortcuts as home screen widgets
- Simple button → SSH command mapping
- **Gap**: No terminal, no streaming output, Android only
- **Learning**: Quick actions concept, but need full terminal context

**Mosh (Mobile Shell)**
- UDP-based SSH replacement
- Handles packet loss, roaming, intermittent connectivity
- **Gap**: Low-level transport, no mobile UI, no voice/AI features
- **Learning**: Network resilience techniques for mobile

### Key Insights from Market

1. **Voice Input is Essential**: Both Termius and Happy Coder prioritize it
2. **Claude Code is Gateway Drug**: Multiple tools targeting this specifically
3. **Cloudflare Tunnels Win**: Free, easy, secure - better than VPN/port forwarding
4. **Mobile-First UX Matters**: Desktop SSH clients don't translate to mobile
5. **E2E Encryption Expected**: Users want zero-knowledge relay architecture
6. **Multi-Session Support**: Developers work on multiple projects simultaneously

### Differentiation Summary

| Feature | Happy Coder | Termius | ARC4DE |
|---------|-------------|---------|--------|
| Plugin System | ❌ Claude Code only | ❌ Generic SSH | ✅ Any CLI tool |
| Voice Input | ✅ Voice-to-action | ✅ Speech-to-text | ✅ Voice-to-action + plugin-aware |
| Cloudflare Tunnels | ✅ Ephemeral | ❌ Manual setup | ✅ Ephemeral + managed |
| E2E Encryption | ✅ Yes | ✅ Yes | ✅ Yes |
| Multi-Server | ⚠️ Limited | ✅ Yes | ✅ Yes |
| Quick Actions | ⚠️ Claude-specific | ⚠️ Snippets | ✅ Plugin-specific |
| Custom UI/Service | ❌ Terminal only | ❌ Terminal only | ✅ Progressive enhancement |
| Open Source | ✅ Yes | ❌ Proprietary | ✅ Yes |
| Self-Hosted | ✅ Yes | ❌ Cloud service | ✅ Yes |
| Pricing | Free | $10-15/mo | Free |

**Market Position**: ARC4DE is the open-source, plugin-extensible evolution of Happy Coder's single-purpose architecture, competing with Termius's polish but maintaining self-hosted control.

## Open Questions

1. **Terminal Emulation**: Use xterm.js library or build custom? (xterm.js is heavy for mobile)

2. **Plugin Isolation**: Should plugins run in separate processes for security/stability?

3. **Plugin Marketplace**: Future: allow installing plugins from UI without backend restart?

4. **Multi-Tenancy**: Support multiple users per backend instance, or one user per instance?

5. **Command Persistence**: Should command history sync across devices?

6. **Plugin Versioning**: How to handle plugin updates without breaking existing installations?

7. **Error Recovery**: If plugin crashes, should we auto-restart or require manual intervention?

8. **Resource Limits**: Should we limit plugin CPU/memory usage? How?

9. **Relay vs Direct**: Should we default to relay server (like Happy Coder) or direct WebSocket? Or support both?

10. **Cloudflare Tunnel Management**: Auto-create tunnels on backend start, or manual setup? How to handle tunnel lifecycle?

## Timeline

### Phase 0: Research & Competitive Analysis (1 week)

**Happy Coder Deep Dive:**
- Install and test Happy Coder CLI + mobile app
- Document architecture (relay server, E2E encryption, tunnel setup)
- Analyze UI/UX patterns and user flows
- Review source code for reusable patterns
- Test failure modes and edge cases
- Document findings and adoption strategy

**Deliverable:** Research report with architectural decisions, UX patterns to adopt, and technical implementation notes

### Phase 1: MVP (4-6 weeks)

**Week 1-2: Core Terminal**
- Backend: WebSocket server, terminal session management
- Frontend: Basic terminal UI, text input, output rendering
- **Cloudflare tunnel integration** (inspired by Happy Coder)
- Deliverable: Can execute arbitrary bash commands remotely

**Week 3-4: Authentication & Multi-Server**
- Backend: JWT auth, server management API
- Frontend: Login flow, server list, connection management
- **QR code pairing** (inspired by Happy Coder)
- Deliverable: Secure, multi-server terminal with easy onboarding

**Week 5-6: Plugin System & Claude Code**
- Backend: Plugin architecture, Claude Code plugin
- Frontend: Plugin integration, voice input
- Deliverable: Fully functional Claude Code remote control

### Phase 2: Enhancement (4-6 weeks)

**Week 7-8: Quick Actions**
- Backend: Plugin quick action API
- Frontend: Quick action UI, customization
- Deliverable: Context-aware shortcuts

**Week 9-10: Additional Plugins**
- GitHub CLI plugin
- AWS CLI plugin (or Docker, based on priority)
- Deliverable: 3+ working plugins

**Week 11-12: Polish**
- Enhanced output rendering
- UI/UX refinements (incorporating Happy Coder lessons)
- Documentation
- Deployment automation
- Deliverable: Production-ready v1.0

**Total: 9-13 weeks to v1.0 (including research phase)**

## Future Roadmap

**v1.1: Service-Specific UIs**
- Claude Code: file diff viewer, artifact renderer
- GitHub: PR review interface
- Docker: container management UI

**v1.2: Collaboration**
- Session sharing
- Team server configurations
- Audit logs UI

**v1.3: Plugin Marketplace**
- In-app plugin discovery
- One-click plugin installation
- Community ratings/reviews

**v2.0: Desktop App**
- Electron wrapper for desktop
- Shared backend
- Cross-platform sync

---

## Appendix A: Similar Tools Comparison

| Tool | Focus | Mobile Support | Plugin System | Self-Hosted |
|------|-------|----------------|---------------|-------------|
| Termius | SSH client | ✅ Excellent | ❌ No | ✅ Yes |
| Blink Shell | iOS terminal | ✅ iOS only | ❌ No | N/A |
| JuiceSSH | Android SSH | ✅ Android only | ❌ No | N/A |
| ARC4DE | CLI orchestration | ✅ PWA (all platforms) | ✅ Yes | ✅ Yes |

**Key Differentiators:**
- Plugin architecture for any CLI tool
- Voice input as first-class feature
- Service-specific enhancements beyond raw terminal
- Progressive enhancement (terminal → quick actions → custom UI)

## Appendix B: Technology Decisions

### Why FastAPI over Node.js?

**Pros:**
- Better async/await for subprocess handling
- Strong typing with pydantic
- Built-in WebSocket support
- Python ecosystem for CLI tools (fabric, paramiko)
- Easy subprocess streaming with asyncio

**Cons:**
- Node.js might be more familiar to web developers
- Python startup time slightly slower

**Decision:** FastAPI for robust subprocess handling and Python CLI ecosystem

### Why React over Vue?

**Pros:**
- Larger ecosystem for mobile-optimized components
- Better TypeScript support
- More examples of terminal emulators in React

**Cons:**
- Vue is lighter and faster for simple apps
- Vue's composition API is cleaner

**Decision:** React for ecosystem and terminal libraries

### Why xterm.js vs Custom Terminal?

**Evaluation needed:**
- xterm.js: Full VT100 emulation, heavy (~500KB)
- Custom: Lighter, mobile-optimized, less feature-complete

**Decision:** Start with custom, migrate to xterm.js if needed

### Why JWT over Session Cookies?

**Pros:**
- Works across domains (PWA on different domain than backend)
- Stateless (easier to scale)
- Mobile-friendly (no cookie issues)

**Cons:**
- Token size larger than session ID
- Can't invalidate without blacklist

**Decision:** JWT for stateless, cross-domain compatibility

## Appendix C: Security Considerations

### Threat Model

**Threats:**
1. Unauthorized access to servers
2. Command injection via plugin vulnerabilities
3. Man-in-the-middle attacks
4. Token theft (XSS, local storage compromise)
5. DDoS attacks on WebSocket endpoint

**Mitigations:**
1. JWT auth + rate limiting + IP whitelist (optional)
2. Input validation, plugin sandboxing (future)
3. HTTPS/WSS only, certificate pinning (optional)
4. Secure token storage, short expiry, refresh mechanism
5. Cloudflare DDoS protection, connection limits

### Compliance

**Self-Hosted Deployment:**
- User is responsible for compliance (GDPR, SOC2, etc.)
- ARC4DE provides audit logging capabilities
- Recommend encrypting audit logs at rest

**Recommendations:**
- Enable audit logging in production
- Rotate JWT secrets regularly
- Use strong passwords/tokens for server auth
- Keep plugin dependencies updated

## Appendix D: Accessibility

**MVP Accessibility:**
- Screen reader support for terminal output
- High contrast mode
- Adjustable font sizes
- Keyboard navigation (for external keyboard users)

**Future Enhancements:**
- Voice-only mode (no screen needed)
- Haptic feedback for command completion
- Customizable color schemes for color blindness

## Appendix E: Performance Optimization

**Frontend:**
- Virtual scrolling for large output
- Lazy load server list
- Debounce voice input processing
- Cache plugin metadata

**Backend:**
- Connection pooling for WebSockets
- Plugin output buffering (send in chunks)
- Command history pagination
- Log rotation for audit logs

**Network:**
- Compress WebSocket messages (zlib)
- Use binary WebSocket frames where applicable
- Implement backpressure handling

---

**Document Version:** 1.0  
**Last Updated:** January 24, 2026  
**Status:** Draft - Awaiting Approval  
**Next Review:** Begin Phase 1 Development
