# ARC4DE Bootstrap Prompt for Claude Code

Copy everything below the line and paste it into Claude Code along with your PRD file.

---

## Prompt

I'm building ARC4DE (Automated Remote Control for Distributed Environments) - a PWA for controlling CLI tools from mobile. I've attached the full PRD.

**Your task: Bootstrap the entire project foundation.**

### 1. Create Project Structure

```
arc4de/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app entry
│   │   ├── config.py            # Settings/env vars
│   │   ├── auth/
│   │   │   ├── __init__.py
│   │   │   ├── jwt.py           # JWT utilities
│   │   │   └── routes.py        # Auth endpoints
│   │   ├── terminal/
│   │   │   ├── __init__.py
│   │   │   ├── session.py       # Terminal session management
│   │   │   └── websocket.py     # WebSocket handler
│   │   └── plugins/
│   │       ├── __init__.py
│   │       ├── base.py          # Plugin base class/interface
│   │       └── claude_code/
│   │           ├── __init__.py
│   │           └── plugin.py    # Claude Code plugin stub
│   ├── plugins/                  # User-installed plugins directory
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Terminal/
│   │   │   │   ├── Terminal.tsx
│   │   │   │   ├── TerminalInput.tsx
│   │   │   │   ├── TerminalOutput.tsx
│   │   │   │   └── index.ts
│   │   │   ├── ServerList/
│   │   │   │   ├── ServerList.tsx
│   │   │   │   ├── ServerCard.tsx
│   │   │   │   └── index.ts
│   │   │   └── Auth/
│   │   │       ├── LoginForm.tsx
│   │   │       └── index.ts
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useTerminal.ts
│   │   │   └── useAuth.ts
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   ├── websocket.ts
│   │   │   └── storage.ts       # IndexedDB wrapper
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── styles/
│   │       └── global.css
│   ├── public/
│   │   └── manifest.json        # PWA manifest
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
└── CLAUDE.md                    # Project context for Claude Code
```

### 2. Generate CLAUDE.md

Create a comprehensive CLAUDE.md file that includes:

**Project Overview:**
- ARC4DE purpose and vision (from PRD)
- Current phase: "Phase 1 Week 1-2: Core Terminal"

**Tech Stack:**
- Backend: FastAPI, Python 3.11+, WebSockets, Pydantic, python-jose (JWT)
- Frontend: React 18, TypeScript, Vite, PWA with service worker
- Database: None for MVP (IndexedDB on frontend for local storage)
- Deployment: Docker, Cloudflare Tunnel support

**Architecture Decisions (locked in for MVP):**
- Terminal emulation: Custom lightweight implementation (not xterm.js)
- Plugin isolation: Same process (separate processes in v2)
- Multi-tenancy: Single user per backend instance
- Connection: Direct WebSocket (relay server in v2)
- Auth: JWT with refresh tokens, stored encrypted in IndexedDB

**Code Style:**
- Python: Black formatter, isort, type hints required
- TypeScript: Strict mode, ESLint + Prettier
- Components: Functional React with hooks only
- Naming: snake_case (Python), camelCase (TypeScript), PascalCase (components)

**Commands:**
```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend  
cd frontend && npm install
npm run dev

# Docker (full stack)
docker-compose up --build
```

**Key Files:**
- `backend/app/plugins/base.py` - Plugin interface definition
- `backend/app/terminal/websocket.py` - Core WebSocket handler
- `frontend/src/hooks/useWebSocket.ts` - WebSocket client hook
- `frontend/src/components/Terminal/Terminal.tsx` - Main terminal component

**Current Sprint Goals:**
1. WebSocket connection between frontend and backend
2. Execute bash commands and stream output
3. Basic terminal UI with input/output
4. ANSI color code support

**Plugin Interface (from PRD):**
```python
class Plugin(ABC):
    name: str
    display_name: str
    
    @abstractmethod
    async def initialize(self) -> None: ...
    
    @abstractmethod
    async def execute(self, command: str) -> AsyncIterator[str]: ...
    
    @abstractmethod
    def get_quick_actions(self) -> List[QuickAction]: ...
    
    def parse_output(self, output: str) -> ParsedOutput: ...
```

### 3. Implement Core Functionality

**Backend - Create working implementations for:**

1. `main.py`: FastAPI app with CORS, WebSocket endpoint at `/ws/terminal`
2. `config.py`: Pydantic settings (JWT_SECRET, ALLOWED_ORIGINS, etc.)
3. `auth/jwt.py`: create_token(), verify_token(), refresh_token()
4. `auth/routes.py`: POST /auth/login, POST /auth/refresh, POST /auth/logout
5. `terminal/session.py`: TerminalSession class that spawns bash subprocess
6. `terminal/websocket.py`: WebSocket handler that:
   - Authenticates via JWT in query param or first message
   - Creates/manages terminal sessions
   - Streams subprocess stdout/stderr to client
   - Handles client input to subprocess stdin
7. `plugins/base.py`: Abstract Plugin base class matching the interface above
8. `plugins/claude_code/plugin.py`: Stub implementation that spawns `claude` CLI

**Frontend - Create working implementations for:**

1. PWA manifest with app name "ARC4DE", theme color, icons placeholder
2. `useWebSocket.ts`: Hook for WebSocket connection with auto-reconnect
3. `useAuth.ts`: Hook for JWT management, login/logout, token refresh
4. `useTerminal.ts`: Hook combining WebSocket + terminal state
5. `Terminal.tsx`: Full-screen terminal with:
   - Scrollable output area (auto-scroll, manual override)
   - Fixed input area at bottom (mobile-friendly)
   - ANSI color code parsing (basic: bold, colors)
   - Monospace font
6. `TerminalInput.tsx`: Text input + send button (voice input placeholder)
7. `TerminalOutput.tsx`: Renders terminal lines with ANSI styling
8. `LoginForm.tsx`: Server URL + token/password input
9. `ServerList.tsx`: List saved servers, add new, select to connect
10. `storage.ts`: IndexedDB wrapper for servers and auth tokens

### 4. Create Docker Setup

**docker-compose.yml** with:
- backend service (FastAPI on port 8000)
- frontend service (Vite dev server on port 5173, or nginx for prod)
- Shared network
- Volume mounts for development

### 5. Create .env.example

```
# Backend
JWT_SECRET=change-me-in-production
JWT_EXPIRY_MINUTES=60
ALLOWED_ORIGINS=http://localhost:5173

# Frontend
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### 6. Create README.md

Include:
- Project description
- Quick start (docker-compose up)
- Development setup (manual)
- Architecture overview
- Link to PRD for full details

---

**Success Criteria:**
After running this bootstrap, I should be able to:
1. `docker-compose up` and access the app
2. Add a server (localhost:8000)
3. Connect and see a terminal
4. Type a command (e.g., `ls`) and see output
5. See ANSI colors rendered properly

**Do not:**
- Over-engineer or add features not listed
- Use xterm.js (we're starting with custom terminal)
- Add database dependencies
- Implement voice input yet (just placeholder)

**Do:**
- Add helpful code comments
- Include TypeScript types for everything
- Make it mobile-first (CSS)
- Handle WebSocket reconnection gracefully
- Log errors appropriately

Start by creating the directory structure and CLAUDE.md, then implement each component. Commit logical chunks as you go.
