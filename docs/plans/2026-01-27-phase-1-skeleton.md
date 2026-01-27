# Phase 1: Skeleton Scaffolding - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the full project scaffolding so `docker-compose up --build` serves an empty FastAPI backend on :8000 and a React PWA frontend on :5173, both with health checks passing.

**Architecture:** Monorepo with `backend/` (Python/FastAPI) and `frontend/` (React/Vite/TypeScript). Docker Compose orchestrates both services. No business logic yet - just the skeleton with configs, empty route stubs, and a working PWA manifest.

**Tech Stack:** Python 3.11, FastAPI 0.115+, uvicorn, Pydantic v2 | React 18, TypeScript 5, Vite 6, TailwindCSS 4, Zustand | Docker, docker-compose

---

## Acceptance Criteria

When Phase 1 is complete, ALL of the following must be true:

1. `docker-compose up --build` starts both services without errors
2. `curl http://localhost:8000/api/health` returns `{"status": "ok"}`
3. `http://localhost:5173` serves the React app in a browser
4. The React app shows "ARC4DE" text and is installable as a PWA (manifest + service worker registered)
5. TailwindCSS classes render correctly in the frontend
6. Backend has CORS configured to allow frontend origin
7. All Python files have type hints; all TypeScript is strict mode
8. `.env.example` documents all configuration variables
9. `.gitignore` covers Python, Node, Docker, IDE, and env files
10. `git log` shows clean, incremental commits per task

---

## Task 1: Initialize Git and Root Config Files

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `docker-compose.yml`

**Step 1: Create .gitignore**

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
*.egg-info/
dist/
build/
.eggs/
*.egg
.venv/
venv/
env/

# Node
node_modules/
frontend/dist/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# Docker
docker-compose.override.yml

# Uploads and data
uploads/
*.db
*.sqlite3

# Logs
logs/
*.log

# Coverage
htmlcov/
.coverage
coverage/
```

**Step 2: Create .env.example**

```.env
# === Backend ===
# Secret key for JWT signing (change in production!)
JWT_SECRET=change-me-in-production-use-a-long-random-string
# JWT access token expiry in minutes
JWT_ACCESS_EXPIRY_MINUTES=15
# JWT refresh token expiry in days
JWT_REFRESH_EXPIRY_DAYS=7
# Password for single-user auth
AUTH_PASSWORD=changeme
# Comma-separated allowed CORS origins
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
# Backend port
BACKEND_PORT=8000

# === Frontend ===
# Backend API URL (used at build time)
VITE_API_URL=http://localhost:8000
# Backend WebSocket URL
VITE_WS_URL=ws://localhost:8000
```

**Step 3: Create docker-compose.yml**

```yaml
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "${BACKEND_PORT:-8000}:8000"
    env_file:
      - .env
    volumes:
      - ./backend:/app
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
```

**Step 4: Copy .env.example to .env for local dev**

Run: `cp .env.example .env`

**Step 5: Commit**

```bash
git add .gitignore .env.example docker-compose.yml
git commit -m "chore: add root config files and docker-compose"
```

---

## Task 2: Backend Skeleton - FastAPI App

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/config.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/auth.py`
- Create: `backend/app/api/sessions.py`
- Create: `backend/app/api/plugins.py`
- Create: `backend/app/ws/__init__.py`
- Create: `backend/app/ws/terminal.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/tmux.py`
- Create: `backend/app/core/auth.py`
- Create: `backend/app/core/audit.py`
- Create: `backend/app/plugins/__init__.py`
- Create: `backend/app/plugins/base.py`
- Create: `backend/app/plugins/manager.py`
- Create: `backend/app/plugins/claude_code/__init__.py`
- Create: `backend/app/plugins/claude_code/plugin.py`
- Create: `backend/requirements.txt`
- Create: `backend/pyproject.toml`
- Create: `backend/Dockerfile`

**Step 1: Create backend directory structure**

Run:
```bash
mkdir -p backend/app/api backend/app/ws backend/app/core backend/app/plugins/claude_code backend/plugins-community
```

**Step 2: Create requirements.txt**

```txt
fastapi>=0.115.0,<1.0.0
uvicorn[standard]>=0.32.0,<1.0.0
pydantic>=2.0.0,<3.0.0
pydantic-settings>=2.0.0,<3.0.0
python-jose[cryptography]>=3.3.0,<4.0.0
passlib[bcrypt]>=1.7.0,<2.0.0
websockets>=13.0,<15.0
```

**Step 3: Create pyproject.toml**

```toml
[project]
name = "arc4de-backend"
version = "0.1.0"
description = "ARC4DE - Automated Remote Control for Distributed Environments"
requires-python = ">=3.11"

[tool.black]
line-length = 88
target-version = ["py311"]

[tool.isort]
profile = "black"
```

**Step 4: Create backend/app/config.py**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_access_expiry_minutes: int = 15
    jwt_refresh_expiry_days: int = 7
    auth_password: str = "changeme"

    # CORS
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    # Server
    backend_port: int = 8000

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
```

**Step 5: Create backend/app/main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

app = FastAPI(
    title="ARC4DE",
    description="Automated Remote Control for Distributed Environments",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
```

**Step 6: Create all __init__.py files (empty)**

Create empty `__init__.py` in:
- `backend/app/__init__.py`
- `backend/app/api/__init__.py`
- `backend/app/ws/__init__.py`
- `backend/app/core/__init__.py`
- `backend/app/plugins/__init__.py`
- `backend/app/plugins/claude_code/__init__.py`

**Step 7: Create stub files for future phases**

Each stub file contains a docstring explaining its purpose and a TODO marker.

`backend/app/api/auth.py`:
```python
"""Authentication API routes (login, refresh, pair, logout).

Implemented in Phase 3.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/auth", tags=["auth"])
```

`backend/app/api/sessions.py`:
```python
"""Session management API routes (list, create, delete tmux sessions).

Implemented in Phase 4.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/sessions", tags=["sessions"])
```

`backend/app/api/plugins.py`:
```python
"""Plugin management API routes (list available plugins, health).

Implemented in Phase 10.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/plugins", tags=["plugins"])
```

`backend/app/ws/terminal.py`:
```python
"""WebSocket terminal handler - PTY <-> tmux <-> WebSocket bridge.

Implemented in Phase 5.
"""
```

`backend/app/core/tmux.py`:
```python
"""tmux session management wrapper.

Implemented in Phase 4.
"""
```

`backend/app/core/auth.py`:
```python
"""JWT create/verify/refresh logic.

Implemented in Phase 3.
"""
```

`backend/app/core/audit.py`:
```python
"""Command audit logging.

Implemented in Phase 13.
"""
```

`backend/app/plugins/base.py`:
```python
"""Plugin abstract base class and QuickAction model.

Implemented in Phase 10.
"""
```

`backend/app/plugins/manager.py`:
```python
"""Plugin discovery, loading, and registry.

Implemented in Phase 10.
"""
```

`backend/app/plugins/claude_code/plugin.py`:
```python
"""Claude Code reference plugin.

Implemented in Phase 10.
"""
```

**Step 8: Create backend/Dockerfile**

```dockerfile
FROM python:3.11-slim

# Install system dependencies (tmux needed for session management)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tmux \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

**Step 9: Verify backend starts**

Run: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --port 8000 &`
Then: `curl http://localhost:8000/api/health`
Expected: `{"status":"ok"}`
Cleanup: Kill the uvicorn process.

**Step 10: Commit**

```bash
git add backend/
git commit -m "feat: add backend skeleton with FastAPI, health endpoint, and project structure"
```

---

## Task 3: Frontend Skeleton - React + Vite + TypeScript + TailwindCSS + PWA

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.app.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/styles/global.css`
- Create: `frontend/src/vite-env.d.ts`
- Create: `frontend/public/manifest.json`
- Create: `frontend/Dockerfile`

**Step 1: Create frontend directory structure**

Run:
```bash
mkdir -p frontend/src/styles frontend/src/layouts frontend/src/components/terminal frontend/src/components/server frontend/src/components/auth frontend/src/hooks frontend/src/stores frontend/src/services frontend/src/types frontend/public/icons
```

**Step 2: Create frontend/package.json**

```json
{
  "name": "arc4de-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint ."
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.1.0",
    "zustand": "^5.0.0",
    "idb-keyval": "^6.2.1",
    "@xterm/xterm": "^5.5.0",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/addon-webgl": "^0.18.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react-swc": "^4.0.0",
    "typescript": "~5.7.0",
    "vite": "^6.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "eslint": "^9.0.0",
    "vite-plugin-pwa": "^0.21.0",
    "workbox-precaching": "^7.0.0"
  }
}
```

**Step 3: Create frontend/tsconfig.json**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

**Step 4: Create frontend/tsconfig.app.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

**Step 5: Create frontend/tsconfig.node.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

**Step 6: Create frontend/vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],
      manifest: false, // We provide our own manifest.json in public/
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
```

**Step 7: Create frontend/src/styles/global.css**

```css
@import "tailwindcss";

:root {
  --color-bg-primary: #0a0e17;
  --color-bg-secondary: #111827;
  --color-bg-tertiary: #1f2937;
  --color-text-primary: #e5e7eb;
  --color-text-secondary: #9ca3af;
  --color-accent: #3b82f6;
  --color-accent-hover: #2563eb;
  --color-success: #22c55e;
  --color-warning: #eab308;
  --color-error: #ef4444;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
  width: 100%;
  overflow: hidden;
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family:
    "Inter",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    sans-serif;
}

/* Ensure smooth scrolling on iOS */
.scroll-container {
  -webkit-overflow-scrolling: touch;
}

/* Terminal font */
.font-mono {
  font-family:
    "JetBrains Mono",
    "Fira Code",
    "Cascadia Code",
    "SF Mono",
    Menlo,
    Monaco,
    "Courier New",
    monospace;
}
```

**Step 8: Create frontend/src/vite-env.d.ts**

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

**Step 9: Create frontend/src/App.tsx**

```tsx
function App() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-6xl">
          ARC
          <span className="text-[var(--color-accent)]">4</span>
          DE
        </h1>
        <p className="mt-4 text-lg text-[var(--color-text-secondary)]">
          Automated Remote Control for Distributed Environments
        </p>
        <div className="mt-8 flex items-center justify-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-success)] animate-pulse" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            System initializing...
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;
```

**Step 10: Create frontend/src/main.tsx**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

**Step 11: Create frontend/index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#0a0e17" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="description" content="ARC4DE - Automated Remote Control for Distributed Environments" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="icon" type="image/png" href="/icons/icon-192.png" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <title>ARC4DE</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 12: Create frontend/public/manifest.json**

```json
{
  "name": "ARC4DE",
  "short_name": "ARC4DE",
  "description": "Automated Remote Control for Distributed Environments",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0e17",
  "theme_color": "#0a0e17",
  "orientation": "any",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

**Step 13: Create placeholder PWA icons**

Generate simple placeholder icons (solid color squares) so the manifest doesn't 404. These will be replaced with real icons in Phase 13.

Run:
```bash
# Create minimal placeholder PNGs using Python
python3 -c "
import struct, zlib

def create_png(width, height, r, g, b):
    def create_chunk(chunk_type, data):
        chunk = chunk_type + data
        return struct.pack('>I', len(data)) + chunk + struct.pack('>I', zlib.crc32(chunk) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = create_chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    raw_data = b''
    for _ in range(height):
        raw_data += b'\x00' + bytes([r, g, b]) * width
    idat = create_chunk(b'IDAT', zlib.compress(raw_data))
    iend = create_chunk(b'IEND', b'')
    return header + ihdr + idat + iend

for size in [192, 512]:
    with open(f'frontend/public/icons/icon-{size}.png', 'wb') as f:
        f.write(create_png(size, size, 10, 14, 23))
"
```

**Step 14: Create frontend/Dockerfile**

```dockerfile
FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy source
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
```

**Step 15: Create stub type file**

`frontend/src/types/index.ts`:
```typescript
/**
 * Shared TypeScript type definitions for ARC4DE frontend.
 *
 * Types are added as features are implemented in subsequent phases.
 */

export interface HealthResponse {
  status: string;
}
```

**Step 16: Verify frontend starts**

Run: `cd frontend && npm install && npm run dev &`
Then: Open `http://localhost:5173` in a browser
Expected: Dark page with "ARC4DE" heading, blue "4", subtitle, green pulsing dot
Cleanup: Kill the vite process.

**Step 17: Commit**

```bash
git add frontend/
git commit -m "feat: add frontend skeleton with React, Vite, TailwindCSS, and PWA manifest"
```

---

## Task 4: Docker Integration - Full Stack Builds and Runs

**Files:**
- Verify: `docker-compose.yml` (created in Task 1)
- Verify: `backend/Dockerfile` (created in Task 2)
- Verify: `frontend/Dockerfile` (created in Task 3)

**Step 1: Build and start with Docker Compose**

Run: `docker-compose up --build`

Expected:
- Backend container builds, starts uvicorn on :8000
- Frontend container builds, `npm install` runs, vite starts on :5173
- Backend health check passes
- No errors in logs

**Step 2: Verify backend health through Docker**

Run (in separate terminal): `curl http://localhost:8000/api/health`
Expected: `{"status":"ok"}`

**Step 3: Verify frontend serves through Docker**

Open `http://localhost:5173` in browser.
Expected: ARC4DE landing page renders with styling.

**Step 4: Verify CORS works**

Run:
```bash
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://localhost:8000/api/health -v 2>&1 | grep -i "access-control"
```
Expected: Response includes `access-control-allow-origin: http://localhost:5173`

**Step 5: Stop Docker Compose**

Run: `docker-compose down`

**Step 6: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: docker-compose integration fixes" # Only if changes were needed
```

---

## Task 5: Final Verification and Phase Completion

**Step 1: Run full acceptance check**

Start services: `docker-compose up --build -d`

Verify all acceptance criteria:
```bash
# 1. Services started
docker-compose ps  # Both should show "running" or "Up"

# 2. Backend health
curl -s http://localhost:8000/api/health | grep '"ok"'

# 3. Frontend serves (check HTTP 200)
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173

# 4. PWA manifest accessible
curl -s http://localhost:5173/manifest.json | grep '"ARC4DE"'

# 5. CORS header present
curl -s -H "Origin: http://localhost:5173" -I http://localhost:8000/api/health | grep -i "access-control"
```

All commands should succeed.

**Step 2: Stop services**

Run: `docker-compose down`

**Step 3: Update CLAUDE.md**

Update the "Current State" section:
```
**Phase:** Phase 1 - Skeleton (COMPLETE)
**Branch:** master
**Last completed:** Phase 1 - Project scaffolding, Docker, backend health, frontend PWA shell
```

Update the phase table:
```
| 1 | Skeleton - scaffolding, configs, Docker, git | COMPLETE |
```

**Step 4: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark Phase 1 skeleton complete"
```

---

## Summary

| Task | Description | Files Created |
|------|-------------|---------------|
| 1 | Root configs (.gitignore, .env, docker-compose) | 3 |
| 2 | Backend skeleton (FastAPI, config, stubs, Dockerfile) | 20 |
| 3 | Frontend skeleton (React, Vite, Tailwind, PWA, Dockerfile) | 15 |
| 4 | Docker integration verification | 0 (verification only) |
| 5 | Final verification and phase completion | 1 (CLAUDE.md update) |

**Total new files:** ~38
**Expected commits:** 4-5
