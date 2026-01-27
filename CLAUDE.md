# ARC4DE - Project Context for Claude Code

## What Is This

ARC4DE (Automated Remote Control for Distributed Environments, pronounced "Arcade") is a PWA + backend system for controlling CLI tools on remote servers from any device. Plugin architecture lets it wrap any CLI tool - starting with Claude Code as the flagship integration.

## Current State

**Phase:** Phase 6 - Frontend Shell (NOT STARTED)
**Branch:** master
**Last completed:** Phase 5 - WebSocket Terminal (PTY bridge, auth, resize, I/O streaming)

## Development Rhythm

We follow a strict plan-then-execute cadence per phase:

1. **Plan** - Write a detailed phase plan to `docs/plans/YYYY-MM-DD-phase-N-<topic>.md`
   - Exact files to create/modify
   - API contracts and function signatures
   - Acceptance criteria (what "done" looks like)
2. **Approve** - User reviews and approves the plan
3. **Execute** - Build exactly what the plan says
4. **Verify** - Confirm acceptance criteria are met
5. **Commit** - Commit the working phase
6. **Update this file** - Update "Current State" above
7. **Next** - Move to next phase planning

**Never skip the planning step. Never execute without approval.**

## Architecture (Summary)

Full design: `docs/plans/2026-01-27-arc4de-architecture-design.md`

### Tech Stack
- **Backend:** Python 3.11+, FastAPI, Starlette WebSockets, Pydantic v2, python-jose (JWT), uvicorn
- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, Zustand, xterm.js, idb-keyval, Workbox
- **Sessions:** tmux (backend infrastructure, abstracted from user)
- **Deployment:** Docker, Cloudflare Tunnels (ephemeral)
- **No Socket.IO** - Native WebSocket API on both ends
- **No database** - IndexedDB on frontend, env config on backend

### Key Decisions (Locked for MVP)
- xterm.js for terminal rendering + custom mobile input layer on top
- Adaptive layouts: Mobile (<768px), Tablet (768-1199px), Desktop (1200px+)
- tmux for persistent sessions (survives app close, backend restart)
- Single-user per backend instance
- JWT auth (15 min access, 7 day refresh)
- Plugin system: Python ABC, auto-discovered from /plugins directories

### WebSocket Protocol
Single connection per server at `/ws/terminal`. JSON messages:
- Client: `auth`, `input`, `resize`, `plugin.activate`, `ping`
- Server: `output`, `auth.ok`, `auth.fail`, `event`, `error`, `pong`

## Build Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | Skeleton - scaffolding, configs, Docker, git | COMPLETE |
| 2 | Backend Core - FastAPI app, CORS, health | COMPLETE (delivered in Phase 1) |
| 3 | Authentication - JWT login/refresh | COMPLETE |
| 4 | tmux Integration - session management wrapper | COMPLETE |
| 5 | WebSocket Terminal - PTY/tmux/WS bridge | COMPLETE |
| 6 | Frontend Shell - routing, adaptive layouts | NOT STARTED |
| 7 | Terminal UI - xterm.js, mobile input, resize | NOT STARTED |
| 8 | Server Management - add/edit/remove, IndexedDB | NOT STARTED |
| 9 | Session Management - picker, resume, status | NOT STARTED |
| 10 | Plugin System - base class, manager, Claude Code | NOT STARTED |
| 11 | Quick Actions - plugin-driven action bar | NOT STARTED |
| 12 | QR Code Pairing - tunnel + scanner | NOT STARTED |
| 13 | Polish - audit, errors, PWA icons, offline | NOT STARTED |

## Project Structure

```
arc4de/
├── backend/
│   ├── app/
│   │   ├── main.py, config.py
│   │   ├── api/        (auth.py, sessions.py, plugins.py)
│   │   ├── ws/         (terminal.py)
│   │   ├── core/       (tmux.py, auth.py, audit.py)
│   │   └── plugins/    (base.py, manager.py, claude_code/)
│   ├── plugins-community/
│   ├── requirements.txt, pyproject.toml, Dockerfile
├── frontend/
│   ├── src/
│   │   ├── layouts/    (MobileLayout, TabletLayout, DesktopLayout)
│   │   ├── components/ (terminal/, server/, auth/)
│   │   ├── hooks/      (useWebSocket, useTerminal, useAuth, useDeviceClass, useSessions)
│   │   ├── stores/     (server, terminal, auth, session)
│   │   ├── services/   (api, websocket, storage)
│   │   ├── types/
│   │   └── styles/
│   ├── public/ (manifest.json, icons/)
│   ├── vite.config.ts, tailwind.config.ts, tsconfig.json, package.json
├── docker-compose.yml
├── .env.example
└── docs/plans/         (phase plans and architecture design)
```

## Code Style

- **Python:** Black formatter, isort, type hints required, snake_case
- **TypeScript:** Strict mode, ESLint + Prettier, camelCase (vars), PascalCase (components)
- **Components:** Functional React with hooks only
- **Commits:** Conventional commits (feat:, fix:, docs:, etc.)

## Commands

```bash
# Backend (development)
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Backend tests
cd backend && python -m pytest tests/ -v

# Frontend (development)
cd frontend && npm install && npm run dev

# Full stack (Docker)
docker-compose up --build

# Tests inside Docker
docker-compose exec backend python -m pytest tests/ -v
```

## Key Docs

- `ARC4DE_PRD.md` - Full product requirements document
- `docs/plans/2026-01-27-arc4de-architecture-design.md` - Approved architecture design
- `docs/plans/` - Phase-specific implementation plans (added as we go)
