# Phase 9: Session Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a session picker page so users can create, list, resume, and delete tmux sessions on a connected server — replacing the current behavior of always creating a new session.

**Architecture:** After login, the user lands on `/sessions` instead of `/terminal`. The SessionPickerPage fetches the server's sessions via `GET /api/sessions`, displays them as cards, and lets the user create or delete sessions. Clicking a session stores its ID in the Zustand server store and navigates to `/terminal`, which passes it through the WebSocket auth message. No new backend work needed — the API and WebSocket protocol already support everything.

**Tech Stack:** React, Zustand (existing serverStore), existing backend session API, existing WebSocket `session_id` protocol.

---

### Task 1: Add SessionInfo type + sessionId to server store

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/stores/serverStore.ts`

**What to build:**

Add `SessionInfo` type to `types/index.ts` (after the existing `ServerConfig` interface):

```typescript
export interface SessionInfo {
  session_id: string;
  name: string;
  tmux_name: string;
  state: string;
  created_at: string;
}
```

Update the `ServerConnection` interface in `serverStore.ts` to include `sessionId`:

```typescript
interface ServerConnection {
  serverId: string;
  accessToken: string;
  connectedAt: number;
  sessionId?: string;
}
```

Add a `setSession` action to `ServerState`:

```typescript
// In the interface:
setSession: (sessionId: string) => void;

// In the create() body:
setSession: (sessionId) => {
  const conn = get().activeConnection;
  if (conn) {
    set({ activeConnection: { ...conn, sessionId } });
  }
},
```

The full updated `serverStore.ts`:

```typescript
import { create } from "zustand";
import type { ServerConfig } from "@/types";
import { loadServers, saveServers } from "@/services/storage";

interface ServerConnection {
  serverId: string;
  accessToken: string;
  connectedAt: number;
  sessionId?: string;
}

interface ServerState {
  servers: ServerConfig[];
  activeConnection: ServerConnection | null;
  loaded: boolean;

  init: () => Promise<void>;
  addServer: (name: string, url: string) => Promise<ServerConfig>;
  updateServer: (id: string, name: string, url: string) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  setConnection: (serverId: string, accessToken: string) => void;
  setSession: (sessionId: string) => void;
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
      url: url.replace(/\/+$/, ""),
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
    if (get().activeConnection?.serverId === id) {
      set({ activeConnection: null });
    }
  },

  setConnection: (serverId, accessToken) => {
    set({
      activeConnection: { serverId, accessToken, connectedAt: Date.now() },
    });
  },

  setSession: (sessionId) => {
    const conn = get().activeConnection;
    if (conn) {
      set({ activeConnection: { ...conn, sessionId } });
    }
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
git add frontend/src/types/index.ts frontend/src/stores/serverStore.ts
git commit -m "feat(frontend): add SessionInfo type and sessionId to server store"
```

---

### Task 2: LoginPage → redirect to /sessions

**Files:**
- Modify: `frontend/src/components/auth/LoginPage.tsx`

**What to build:**

One-line change. On line 49, change:

```typescript
navigate("/terminal");
```

to:

```typescript
navigate("/sessions");
```

**Verify:**

```bash
cd frontend && npx tsc --noEmit
```

**Commit:**

```bash
git add frontend/src/components/auth/LoginPage.tsx
git commit -m "feat(frontend): redirect login to sessions page instead of terminal"
```

---

### Task 3: SessionPickerPage UI

**Files:**
- Modify: `frontend/src/components/terminal/SessionPickerPage.tsx`

**What to build:**

Replace the placeholder with a full session picker. Three states: loading, empty, list. Uses the active server connection to fetch sessions from the backend API.

Includes:
- Header showing server name + "Disconnect" button
- Session cards with name, state badge (green/gray dot), relative age
- "New Session" button → inline form with name input
- Delete with two-step confirm
- Click card → store sessionId → navigate to `/terminal`

Helper function for relative time (no library):

```typescript
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
```

Full implementation:

```tsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useServerStore } from "@/stores/serverStore";
import type { SessionInfo } from "@/types";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function SessionPickerPage() {
  const navigate = useNavigate();
  const { activeConnection, servers, setSession, clearConnection } =
    useServerStore();
  const activeServer = servers.find(
    (s) => s.id === activeConnection?.serverId,
  );

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Redirect if not connected to a server
  useEffect(() => {
    if (!activeConnection || !activeServer) {
      navigate("/");
    }
  }, [activeConnection, activeServer, navigate]);

  const fetchSessions = useCallback(async () => {
    if (!activeServer || !activeConnection) return;
    try {
      const resp = await fetch(`${activeServer.url}/api/sessions`, {
        headers: { Authorization: `Bearer ${activeConnection.accessToken}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: SessionInfo[] = await resp.json();
      setSessions(data);
      setError("");
    } catch {
      setError("Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }, [activeServer, activeConnection]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || !activeServer || !activeConnection) return;
    setCreating(true);
    try {
      const resp = await fetch(`${activeServer.url}/api/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeConnection.accessToken}`,
        },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setName("");
      setShowForm(false);
      await fetchSessions();
    } catch {
      setError("Failed to create session.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (confirmDeleteId === sessionId) {
      if (!activeServer || !activeConnection) return;
      try {
        await fetch(`${activeServer.url}/api/sessions/${sessionId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${activeConnection.accessToken}` },
        });
        setConfirmDeleteId(null);
        await fetchSessions();
      } catch {
        setError("Failed to delete session.");
      }
    } else {
      setConfirmDeleteId(sessionId);
    }
  };

  const handleSelect = (sessionId: string) => {
    if (confirmDeleteId) return;
    setSession(sessionId);
    navigate("/terminal");
  };

  const handleDisconnect = () => {
    clearConnection();
    navigate("/");
  };

  if (!activeConnection || !activeServer) return null;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-[var(--color-text-secondary)]">
          Loading sessions...
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            Sessions
          </h1>
          <p className="truncate text-xs text-[var(--color-text-secondary)]">
            {activeServer.name} — {activeServer.url}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {!showForm && (
            <button
              onClick={() => {
                setShowForm(true);
                setName("");
                setConfirmDeleteId(null);
              }}
              className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
            >
              New Session
            </button>
          )}
          <button
            onClick={handleDisconnect}
            className="rounded px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded bg-[var(--color-error)]/10 px-3 py-2 text-sm text-[var(--color-error)]">
          {error}
        </div>
      )}

      {/* New Session Form */}
      {showForm && (
        <div className="mb-4 rounded-lg border border-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)] p-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
            New Session
          </h2>
          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Session name (e.g. dev server)"
              className="w-full rounded bg-[var(--color-bg-tertiary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-secondary)] focus:ring-1 focus:ring-[var(--color-accent)]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              disabled={creating}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating || !name.trim()}
                className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {sessions.length === 0 && !showForm && (
        <div className="flex flex-1 flex-col items-center justify-center">
          <p className="text-[var(--color-text-secondary)]">
            No sessions on this server.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
          >
            Create your first session
          </button>
        </div>
      )}

      {/* Session list */}
      <div className="space-y-2">
        {sessions.map((session) => (
          <div
            key={session.session_id}
            onClick={() => handleSelect(session.session_id)}
            className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)] p-4 transition-colors hover:border-[var(--color-accent)]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      session.state === "active"
                        ? "var(--color-success)"
                        : "var(--color-text-secondary)",
                  }}
                />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {session.name}
                </span>
              </div>
              <div className="mt-0.5 flex gap-2 pl-4 text-xs text-[var(--color-text-secondary)]">
                <span>
                  {session.state === "active" ? "Active" : "Detached"}
                </span>
                {session.created_at && (
                  <>
                    <span>·</span>
                    <span>{relativeTime(session.created_at)}</span>
                  </>
                )}
              </div>
            </div>
            <div className="ml-3 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(session.session_id);
                }}
                className={`rounded px-2 py-1 text-xs ${
                  confirmDeleteId === session.session_id
                    ? "bg-[var(--color-error)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-error)]"
                }`}
              >
                {confirmDeleteId === session.session_id
                  ? "Confirm?"
                  : "Delete"}
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

Visually: navigate to `http://localhost:5175/`, add a server, login → should land on `/sessions` with "No sessions on this server." message. Create a session, see it appear as a card.

**Commit:**

```bash
git add frontend/src/components/terminal/SessionPickerPage.tsx
git commit -m "feat(frontend): implement SessionPickerPage with create/list/delete"
```

---

### Task 4: Wire TerminalPage to use sessionId

**Files:**
- Modify: `frontend/src/components/terminal/TerminalPage.tsx`

**What to build:**

Two changes to TerminalPage:

1. Change the redirect guard: if there's a connection but no `sessionId`, redirect to `/sessions` instead of `/`.

2. Pass `sessionId` to `ws.connect()`.

Replace lines 48-81 (the main `useEffect`) with:

```tsx
// Wire terminal <-> WebSocket
useEffect(() => {
  if (!terminal) return;
  if (!activeConnection || !activeServer) {
    navigate("/");
    return;
  }
  if (!activeConnection.sessionId) {
    navigate("/sessions");
    return;
  }

  const disposables: { dispose: () => void }[] = [];

  ws.setHandlers({
    onOutput: (data) => terminal.write(data),
    onStateChange: setConnState,
    onError: (msg) => terminal.writeln(`\r\n\x1b[31m[Error] ${msg}\x1b[0m`),
  });

  disposables.push(
    terminal.onData((data) => ws.sendInput(data)),
  );

  disposables.push(
    terminal.onResize(({ cols, rows }) => ws.sendResize(cols, rows)),
  );

  // Connect using stored token, session ID, and server URL
  ws.connect(
    activeConnection.accessToken,
    activeConnection.sessionId,
    activeServer.url,
  );

  return () => {
    disposables.forEach((d) => d.dispose());
    ws.disconnect();
  };
}, [terminal, ws, activeConnection, activeServer, navigate]);
```

The key differences from the current code:
- Added guard: `if (!activeConnection.sessionId) { navigate("/sessions"); return; }`
- Changed `ws.connect()` call: `undefined` → `activeConnection.sessionId`

**Verify:**

```bash
cd frontend && npx tsc --noEmit
```

Full flow test: Add server → login → see sessions → create session → click it → terminal opens and connects to that specific session.

**Commit:**

```bash
git add frontend/src/components/terminal/TerminalPage.tsx
git commit -m "feat(frontend): pass sessionId through WebSocket, guard for missing session"
```

---

### Task 5: E2E verification + CLAUDE.md

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
   - Click server card → navigates to `/login?server={id}`
   - Enter password → click Connect
   - Redirects to `/sessions` (NOT `/terminal`)
   - See "No sessions on this server." empty state
   - Click "New Session" → enter name "dev" → click Create
   - Session card appears with name "dev", green/gray dot, relative age
   - Click the session card → navigates to `/terminal`
   - Terminal connects and shows shell prompt
   - Navigate back to `/sessions` → session is still listed
   - Create a second session → both listed
   - Delete one session (click Delete → Confirm?)
   - Click remaining session → terminal reconnects

4. **Update CLAUDE.md** — mark Phase 9 complete, update current state

**Commit:**

```bash
git add CLAUDE.md
git commit -m "docs: mark Phase 9 session management complete"
```
