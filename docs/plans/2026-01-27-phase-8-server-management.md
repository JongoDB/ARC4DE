# Phase 8: Server Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add/edit/remove servers in the UI with IndexedDB persistence, powering the connection flow from server selection through login to terminal.

**Architecture:** A Zustand store (`useServerStore`) holds the server list in memory and syncs to IndexedDB via `idb-keyval`. The `ServerListPage` renders server cards with add/edit/delete. Selecting a server navigates to `/login?server={id}`, which authenticates and stores the token, then redirects to `/terminal`. The `TerminalPage` reads the active server + token from the store instead of hardcoding `fetch("/api/auth/login")`.

**Tech Stack:** Zustand 5, idb-keyval 6, React Router (useNavigate, useSearchParams), existing TailwindCSS design tokens.

---

## Data Model

```typescript
// A server the user has configured
interface ServerConfig {
  id: string;           // crypto.randomUUID()
  name: string;         // User-friendly label ("Home Lab", "Production")
  url: string;          // Base URL ("https://myserver.example.com" or "http://192.168.1.50:8000")
  addedAt: number;      // Date.now() when created
}

// Runtime connection state (not persisted)
interface ServerConnection {
  serverId: string;
  accessToken: string;
  connectedAt: number;
}
```

---

### Task 1: Server types + idb-keyval storage service

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/services/storage.ts`

**What to build:**

Add `ServerConfig` type to `types/index.ts`:

```typescript
export interface ServerConfig {
  id: string;
  name: string;
  url: string;
  addedAt: number;
}
```

Create `services/storage.ts` — a thin wrapper around `idb-keyval` for server persistence:

```typescript
import { get, set } from "idb-keyval";
import type { ServerConfig } from "@/types";

const SERVERS_KEY = "arc4de-servers";

export async function loadServers(): Promise<ServerConfig[]> {
  return (await get<ServerConfig[]>(SERVERS_KEY)) ?? [];
}

export async function saveServers(servers: ServerConfig[]): Promise<void> {
  await set(SERVERS_KEY, servers);
}
```

**Verify:**

```bash
cd frontend && npx tsc --noEmit
```

**Commit:**

```bash
git add frontend/src/types/index.ts frontend/src/services/storage.ts
git commit -m "feat(frontend): add ServerConfig type and idb-keyval storage service"
```

---

### Task 2: Zustand server store

**Files:**
- Create: `frontend/src/stores/serverStore.ts`

**What to build:**

A Zustand store managing the server list + active connection state. Loads from IndexedDB on init, syncs on every mutation.

```typescript
import { create } from "zustand";
import type { ServerConfig } from "@/types";
import { loadServers, saveServers } from "@/services/storage";

interface ServerConnection {
  serverId: string;
  accessToken: string;
  connectedAt: number;
}

interface ServerState {
  servers: ServerConfig[];
  activeConnection: ServerConnection | null;
  loaded: boolean;

  // Actions
  init: () => Promise<void>;
  addServer: (name: string, url: string) => Promise<ServerConfig>;
  updateServer: (id: string, name: string, url: string) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  setConnection: (serverId: string, accessToken: string) => void;
  clearConnection: () => void;
}

export const useServerStore = create<ServerState>()((set, get) => ({
  servers: [],
  activeConnection: null,
  loaded: false,

  init: async () => {
    if (get().loaded) return;
    const servers = await loadServers();
    set({ servers, loaded: true });
  },

  addServer: async (name, url) => {
    const server: ServerConfig = {
      id: crypto.randomUUID(),
      name,
      url: url.replace(/\/+$/, ""), // strip trailing slashes
      addedAt: Date.now(),
    };
    const next = [...get().servers, server];
    set({ servers: next });
    await saveServers(next);
    return server;
  },

  updateServer: async (id, name, url) => {
    const next = get().servers.map((s) =>
      s.id === id ? { ...s, name, url: url.replace(/\/+$/, "") } : s,
    );
    set({ servers: next });
    await saveServers(next);
  },

  removeServer: async (id) => {
    const next = get().servers.filter((s) => s.id !== id);
    set({ servers: next });
    await saveServers(next);
    // Clear connection if we just removed the active server
    if (get().activeConnection?.serverId === id) {
      set({ activeConnection: null });
    }
  },

  setConnection: (serverId, accessToken) => {
    set({ activeConnection: { serverId, accessToken, connectedAt: Date.now() } });
  },

  clearConnection: () => {
    set({ activeConnection: null });
  },
}));
```

**Verify:**

```bash
cd frontend && npx tsc --noEmit
```

**Commit:**

```bash
git add frontend/src/stores/serverStore.ts
git commit -m "feat(frontend): add Zustand server store with IndexedDB persistence"
```

---

### Task 3: ServerListPage UI

**Files:**
- Modify: `frontend/src/components/server/ServerListPage.tsx`

**What to build:**

Replace the placeholder with a real server list page. Three states:
1. **Loading** — store hasn't loaded from IndexedDB yet
2. **Empty** — no servers configured, show "Add your first server" CTA
3. **List** — server cards with name, URL, edit/delete buttons

Add Server modal: a simple inline form (name + URL) that appears at the top. No separate route.

Important UI patterns:
- Use existing CSS variables (`--color-bg-secondary`, `--color-accent`, etc.)
- Cards should be tappable on mobile (navigate to login on click)
- Edit is inline (same form as add, pre-filled)
- Delete has a confirmation step (button turns red with "Confirm?" text)
- "Add Server" button is always visible (top-right or bottom of list)

```tsx
// ServerListPage.tsx — full implementation

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useServerStore } from "@/stores/serverStore";
import type { ServerConfig } from "@/types";

export function ServerListPage() {
  const navigate = useNavigate();
  const { servers, loaded, init, addServer, updateServer, removeServer } =
    useServerStore();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) return;

    if (editingId) {
      await updateServer(editingId, trimmedName, trimmedUrl);
    } else {
      await addServer(trimmedName, trimmedUrl);
    }
    resetForm();
  };

  const startEdit = (server: ServerConfig) => {
    setEditingId(server.id);
    setName(server.name);
    setUrl(server.url);
    setShowForm(true);
    setConfirmDeleteId(null);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setUrl("");
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId === id) {
      await removeServer(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

  const handleCardClick = (server: ServerConfig) => {
    if (confirmDeleteId || editingId) return; // don't navigate while editing/deleting
    navigate(`/login?server=${server.id}`);
  };

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-[var(--color-text-secondary)]">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
          Servers
        </h1>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
          >
            Add Server
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-4 rounded-lg border border-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)] p-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
            {editingId ? "Edit Server" : "Add Server"}
          </h2>
          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Server name (e.g. Home Lab)"
              className="w-full rounded bg-[var(--color-bg-tertiary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-secondary)] focus:ring-1 focus:ring-[var(--color-accent)]"
              autoFocus
            />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL (e.g. https://myserver.example.com)"
              className="w-full rounded bg-[var(--color-bg-tertiary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-secondary)] focus:ring-1 focus:ring-[var(--color-accent)]"
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
              >
                {editingId ? "Save" : "Add"}
              </button>
              <button
                onClick={resetForm}
                className="rounded px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {servers.length === 0 && !showForm && (
        <div className="flex flex-1 flex-col items-center justify-center">
          <p className="text-[var(--color-text-secondary)]">
            No servers configured yet.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
          >
            Add your first server
          </button>
        </div>
      )}

      {/* Server list */}
      <div className="space-y-2">
        {servers.map((server) => (
          <div
            key={server.id}
            onClick={() => handleCardClick(server)}
            className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)] p-4 transition-colors hover:border-[var(--color-accent)]"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                {server.name}
              </div>
              <div className="truncate text-xs text-[var(--color-text-secondary)]">
                {server.url}
              </div>
            </div>
            <div className="ml-3 flex shrink-0 gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); startEdit(server); }}
                className="rounded px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(server.id); }}
                className={`rounded px-2 py-1 text-xs ${
                  confirmDeleteId === server.id
                    ? "bg-[var(--color-error)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-error)]"
                }`}
              >
                {confirmDeleteId === server.id ? "Confirm?" : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Verify:**

```bash
cd frontend && npx tsc --noEmit
```

Visually: navigate to `http://localhost:5175/` — should see "Servers" heading with "Add Server" button. Add a server, see it appear as a card. Edit it, delete it.

**Commit:**

```bash
git add frontend/src/components/server/ServerListPage.tsx
git commit -m "feat(frontend): implement ServerListPage with add/edit/delete"
```

---

### Task 4: LoginPage with server-aware auth

**Files:**
- Modify: `frontend/src/components/auth/LoginPage.tsx`

**What to build:**

Replace the placeholder with a real login form. Reads `?server={id}` from URL, looks up the `ServerConfig` from the store, POSTs to that server's `/api/auth/login`, stores the token in the server store, and navigates to `/terminal`.

```tsx
// LoginPage.tsx — full implementation

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useServerStore } from "@/stores/serverStore";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serverId = searchParams.get("server");

  const { servers, loaded, init, setConnection } = useServerStore();
  const server = servers.find((s) => s.id === serverId);

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  // Redirect if no server specified or not found
  useEffect(() => {
    if (loaded && (!serverId || !server)) {
      navigate("/");
    }
  }, [loaded, serverId, server, navigate]);

  const handleSubmit = async () => {
    if (!server || !password.trim()) return;
    setError("");
    setSubmitting(true);

    try {
      const resp = await fetch(`${server.url}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        setError(data?.detail ?? `Login failed (${resp.status})`);
        setSubmitting(false);
        return;
      }

      const data = await resp.json();
      setConnection(server.id, data.access_token);
      navigate("/terminal");
    } catch {
      setError("Could not reach server. Check the URL and try again.");
      setSubmitting(false);
    }
  };

  if (!loaded || !server) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-[var(--color-text-secondary)]">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            Connect to {server.name}
          </h1>
          <p className="mt-1 truncate text-sm text-[var(--color-text-secondary)]">
            {server.url}
          </p>
        </div>

        {error && (
          <div className="rounded bg-[var(--color-error)]/10 px-3 py-2 text-sm text-[var(--color-error)]">
            {error}
          </div>
        )}

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded bg-[var(--color-bg-tertiary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-secondary)] focus:ring-1 focus:ring-[var(--color-accent)]"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          disabled={submitting}
        />

        <button
          onClick={handleSubmit}
          disabled={submitting || !password.trim()}
          className="w-full rounded bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {submitting ? "Connecting..." : "Connect"}
        </button>

        <button
          onClick={() => navigate("/")}
          className="w-full text-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          Back to servers
        </button>
      </div>
    </div>
  );
}
```

**Key design decisions:**
- `fetch()` goes directly to the server URL (not the Vite proxy) since each server has its own URL
- On success, stores `serverId` + `accessToken` in Zustand (memory only — tokens aren't persisted to IndexedDB)
- Error states: wrong password, unreachable server, generic failure

**Verify:**

```bash
cd frontend && npx tsc --noEmit
```

Visually: Click a server card on `/` → navigates to `/login?server={id}` → enter password → connects → redirects to `/terminal`.

**Commit:**

```bash
git add frontend/src/components/auth/LoginPage.tsx
git commit -m "feat(frontend): implement LoginPage with server-aware authentication"
```

---

### Task 5: Wire TerminalPage to server store + update WebSocket URL

**Files:**
- Modify: `frontend/src/components/terminal/TerminalPage.tsx`
- Modify: `frontend/src/services/websocket.ts`

**What to build:**

Two changes:

**1. WebSocketService: accept a custom base URL**

Currently `_connect()` builds the URL from `window.location`. Change it to accept an optional `baseUrl` parameter in `connect()`:

In `websocket.ts`, change the `connect` method signature and `_connect` to use a configurable URL:

```typescript
// In connect():
connect(token: string, sessionId?: string, baseUrl?: string): void {
  this.token = token;
  this.sessionId = sessionId;
  this.baseUrl = baseUrl;
  // ... rest unchanged
}

// In _connect():
private _connect(): void {
  this._cleanup();
  this._setState("connecting");

  let url: string;
  if (this.baseUrl) {
    // Convert http(s):// to ws(s)://
    const wsBase = this.baseUrl.replace(/^http/, "ws");
    url = `${wsBase}/ws/terminal`;
  } else {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    url = `${protocol}//${window.location.host}/ws/terminal`;
  }

  this.ws = new WebSocket(url);
  // ... rest unchanged
}
```

Add `private baseUrl: string | undefined;` to the class fields.

**2. TerminalPage: use active connection from store**

Replace the hardcoded `fetch("/api/auth/login", ...)` with reading from the server store. If there's no active connection, redirect to `/`.

Key changes to TerminalPage:

```tsx
// Add imports
import { useServerStore } from "@/stores/serverStore";
import { useNavigate } from "react-router-dom";

// Inside TerminalPage:
const navigate = useNavigate();
const { activeConnection, servers } = useServerStore();
const activeServer = servers.find(
  (s) => s.id === activeConnection?.serverId,
);

// Replace the auto-login useEffect with:
useEffect(() => {
  if (!terminal) return;
  if (!activeConnection || !activeServer) {
    navigate("/");
    return;
  }

  // Wire handlers
  const disposables: { dispose: () => void }[] = [];

  ws.setHandlers({
    onOutput: (data) => terminal.write(data),
    onStateChange: setConnState,
    onError: (msg) => terminal.writeln(`\r\n\x1b[31m[Error] ${msg}\x1b[0m`),
  });

  disposables.push(terminal.onData((data) => ws.sendInput(data)));
  disposables.push(terminal.onResize(({ cols, rows }) => ws.sendResize(cols, rows)));

  // Connect using stored token and server URL
  ws.connect(activeConnection.accessToken, undefined, activeServer.url);

  return () => {
    disposables.forEach((d) => d.dispose());
    ws.disconnect();
  };
}, [terminal, ws, activeConnection, activeServer, navigate]);
```

Remove the old `fetch("/api/auth/login", ...)` block entirely.

**Verify:**

```bash
cd frontend && npx tsc --noEmit
```

Full flow test: Add a server at `/` → click it → login → terminal connects using the server's URL.

**Commit:**

```bash
git add frontend/src/services/websocket.ts frontend/src/components/terminal/TerminalPage.tsx
git commit -m "feat(frontend): wire TerminalPage to server store, configurable WS URL"
```

---

### Task 6: E2E verification

**No new files. Verification only.**

**Checklist:**

1. **TypeScript compiles clean:**
   ```bash
   cd frontend && npx tsc --noEmit
   ```

2. **Backend tests still pass:**
   ```bash
   cd backend && python3 -m pytest tests/ -v --tb=short
   ```

3. **Visual flow test (browser):**
   - Navigate to `http://localhost:5175/`
   - See "Servers" page with "Add Server" button
   - Click "Add Server", enter name "Local Dev" and URL `http://localhost:5175` (uses Vite proxy)
   - Server card appears with name and URL
   - Click the card → navigates to `/login?server={id}`
   - Enter password "changeme" → click Connect
   - Redirects to `/terminal` → terminal connects and shows shell prompt
   - Navigate back to `/` → server card still there (persisted in IndexedDB)
   - Edit the server name → saves
   - Delete the server → confirm → removed

4. **Update CLAUDE.md** — mark Phase 8 complete, update current state

**Commit:**

```bash
git add CLAUDE.md
git commit -m "docs: mark Phase 8 server management complete"
```
