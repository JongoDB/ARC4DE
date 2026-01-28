# UI Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Modernize ARC4DE's UI with SaaS-quality visual polish using Lucide icons, refined colors, better cards, and smooth interactions.

**Architecture:** Pure frontend changes - update CSS variables, add Lucide React, refactor each page component for better visuals while preserving all functionality.

**Tech Stack:** React, TypeScript, TailwindCSS, Lucide React

---

## Task 1: Install Lucide React and Update CSS Variables

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/styles/global.css`

**Step 1: Install lucide-react**

Run: `cd frontend && npm install lucide-react`

**Step 2: Update CSS variables in global.css**

Replace the `:root` block with:

```css
:root {
  /* Backgrounds - more depth */
  --color-bg-primary: #0a0e17;
  --color-bg-secondary: #0f1419;
  --color-bg-tertiary: #1a1f2e;
  --color-bg-elevated: #1e2433;

  /* Text - slightly warmer */
  --color-text-primary: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;

  /* Accent */
  --color-accent: #3b82f6;
  --color-accent-hover: #60a5fa;
  --color-accent-muted: rgba(59, 130, 246, 0.15);

  /* Status */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;

  /* Borders */
  --color-border: #1e293b;
  --color-border-hover: #334155;
}
```

**Step 3: Verify app still loads**

Run: `cd frontend && npm run dev`
Check: http://localhost:5175 loads without errors

**Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/styles/global.css
git commit -m "feat(ui): install lucide-react and update color palette"
```

---

## Task 2: Redesign Desktop Sidebar

**Files:**
- Modify: `frontend/src/layouts/DesktopLayout.tsx`

**Step 1: Add icons and refine sidebar styling**

Replace entire file with:

```tsx
import { Outlet, Link, useLocation } from "react-router-dom";
import { Server, Layers, Terminal } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "Servers", icon: Server },
  { path: "/sessions", label: "Sessions", icon: Layers },
  { path: "/terminal", label: "Terminal", icon: Terminal },
];

export function DesktopLayout() {
  const location = useLocation();

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        {/* Logo */}
        <div className="flex h-14 items-center border-b border-[var(--color-border)] px-5">
          <span className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
            ARC<span className="text-[var(--color-accent)]">4</span>DE
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main className="min-h-0 min-w-0 flex-1 bg-[var(--color-bg-primary)]">
        <Outlet />
      </main>
    </div>
  );
}
```

**Step 2: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/layouts/DesktopLayout.tsx
git commit -m "feat(ui): redesign desktop sidebar with icons"
```

---

## Task 3: Update Mobile and Tablet Layouts

**Files:**
- Modify: `frontend/src/layouts/MobileLayout.tsx`
- Modify: `frontend/src/layouts/TabletLayout.tsx`

**Step 1: Update MobileLayout with icons**

```tsx
import { Outlet, Link, useLocation } from "react-router-dom";
import { Server, Layers, Terminal } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "Servers", icon: Server },
  { path: "/sessions", label: "Sessions", icon: Layers },
  { path: "/terminal", label: "Terminal", icon: Terminal },
];

export function MobileLayout() {
  const location = useLocation();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4">
        <span className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
          ARC<span className="text-[var(--color-accent)]">4</span>DE
        </span>
      </header>

      {/* Main content */}
      <main className="min-h-0 flex-1 overflow-hidden bg-[var(--color-bg-primary)]">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="flex h-14 shrink-0 items-center justify-around border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 px-4 py-1 ${
                isActive
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-secondary)]"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
```

**Step 2: Update TabletLayout (same as Desktop but narrower sidebar)**

```tsx
import { Outlet, Link, useLocation } from "react-router-dom";
import { Server, Layers, Terminal } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "Servers", icon: Server },
  { path: "/sessions", label: "Sessions", icon: Layers },
  { path: "/terminal", label: "Terminal", icon: Terminal },
];

export function TabletLayout() {
  const location = useLocation();

  return (
    <div className="flex h-full">
      {/* Narrow sidebar - icons only */}
      <aside className="flex w-16 shrink-0 flex-col items-center border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        {/* Logo */}
        <div className="flex h-14 w-full items-center justify-center border-b border-[var(--color-border)]">
          <span className="text-lg font-bold text-[var(--color-accent)]">4</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          <div className="flex flex-col items-center gap-2">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={item.label}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                    isActive
                      ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main className="min-h-0 min-w-0 flex-1 bg-[var(--color-bg-primary)]">
        <Outlet />
      </main>
    </div>
  );
}
```

**Step 3: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add frontend/src/layouts/MobileLayout.tsx frontend/src/layouts/TabletLayout.tsx
git commit -m "feat(ui): update mobile and tablet layouts with icons"
```

---

## Task 4: Redesign Server List Page

**Files:**
- Modify: `frontend/src/components/server/ServerListPage.tsx`

**Step 1: Rewrite with modern card design**

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useServerStore } from "@/stores/serverStore";
import type { ServerConfig } from "@/types";
import { Plus, Server, Pencil, Trash2, ExternalLink } from "lucide-react";

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
    if (confirmDeleteId || editingId) return;
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
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            Servers
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {servers.length === 0
              ? "No servers configured"
              : `${servers.length} server${servers.length === 1 ? "" : "s"} configured`}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] hover:shadow-lg hover:shadow-blue-500/20"
          >
            <Plus size={16} />
            Add Server
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
          <h2 className="mb-4 text-base font-semibold text-[var(--color-text-primary)]">
            {editingId ? "Edit Server" : "Add Server"}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Home Lab"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://myserver.example.com"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSubmit}
                disabled={!name.trim() || !url.trim()}
                className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
              >
                {editingId ? "Save Changes" : "Add Server"}
              </button>
              <button
                onClick={resetForm}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
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
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-bg-tertiary)]">
            <Server size={32} className="text-[var(--color-text-muted)]" />
          </div>
          <p className="mt-4 text-[var(--color-text-secondary)]">
            No servers configured yet
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)]"
          >
            <Plus size={16} />
            Add your first server
          </button>
        </div>
      )}

      {/* Server list */}
      <div className="space-y-3">
        {servers.map((server) => (
          <div
            key={server.id}
            onClick={() => handleCardClick(server)}
            className="group flex cursor-pointer items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--color-border-hover)] hover:shadow-lg hover:shadow-black/20"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)]">
                <Server size={20} className="text-[var(--color-text-secondary)]" />
              </div>
              <div>
                <div className="font-medium text-[var(--color-text-primary)]">
                  {server.name}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
                  <span className="truncate">{server.url}</span>
                  <ExternalLink size={12} className="shrink-0 opacity-50" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(server);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
                title="Edit"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(server.id);
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  confirmDeleteId === server.id
                    ? "bg-[var(--color-error)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-error)]"
                }`}
                title={confirmDeleteId === server.id ? "Click to confirm" : "Delete"}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/src/components/server/ServerListPage.tsx
git commit -m "feat(ui): redesign server list page with modern cards"
```

---

## Task 5: Redesign Login Page

**Files:**
- Modify: `frontend/src/components/auth/LoginPage.tsx`

**Step 1: Rewrite with centered card design**

```tsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useServerStore } from "@/stores/serverStore";
import { Server, Lock, ArrowLeft, AlertCircle } from "lucide-react";

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
      navigate("/sessions");
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
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
          {/* Server info */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)]">
              <Server size={24} className="text-[var(--color-accent)]" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-semibold text-[var(--color-text-primary)]">
                {server.name}
              </h1>
              <p className="truncate text-sm text-[var(--color-text-muted)]">
                {server.url}
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3 py-2 text-sm text-[var(--color-error)]">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Password field */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Password
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !password.trim()}
            className="w-full rounded-lg bg-[var(--color-accent)] py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {submitting ? "Connecting..." : "Connect"}
          </button>
        </div>

        {/* Back link */}
        <button
          onClick={() => navigate("/")}
          className="mt-4 flex w-full items-center justify-center gap-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft size={16} />
          Back to servers
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/src/components/auth/LoginPage.tsx
git commit -m "feat(ui): redesign login page with centered card"
```

---

## Task 6: Redesign Session Picker Page

**Files:**
- Modify: `frontend/src/components/terminal/SessionPickerPage.tsx`

**Step 1: Rewrite with modern design**

```tsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useServerStore } from "@/stores/serverStore";
import type { SessionInfo, PluginInfo } from "@/types";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Terminal,
  Layers,
  LogOut,
} from "lucide-react";

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
    (s) => s.id === activeConnection?.serverId
  );

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState("shell");

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

  useEffect(() => {
    if (!activeServer || !activeConnection) return;
    (async () => {
      try {
        const resp = await fetch(`${activeServer.url}/api/plugins`, {
          headers: { Authorization: `Bearer ${activeConnection.accessToken}` },
        });
        if (!resp.ok) return;
        const data: PluginInfo[] = await resp.json();
        setPlugins(data);
      } catch {
        // Non-critical
      }
    })();
  }, [activeServer, activeConnection]);

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
        body: JSON.stringify({ name: trimmed, plugin: selectedPlugin }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setName("");
      setSelectedPlugin("shell");
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

  const handleSelect = (sessionId: string, plugin: string) => {
    if (confirmDeleteId) return;
    setSession(sessionId, plugin);
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
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              {activeServer.name}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              {sessions.length} session{sessions.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
        >
          <LogOut size={16} />
          Disconnect
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
          {error}
        </div>
      )}

      {/* New Session Card */}
      <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
        {!showForm ? (
          <button
            onClick={() => {
              setShowForm(true);
              setName("");
              setConfirmDeleteId(null);
            }}
            className="flex w-full items-center gap-3 text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-accent-muted)]">
              <Plus size={20} className="text-[var(--color-accent)]" />
            </div>
            <div>
              <div className="font-medium text-[var(--color-text-primary)]">
                New Session
              </div>
              <div className="text-sm text-[var(--color-text-muted)]">
                Create a new terminal session
              </div>
            </div>
          </button>
        ) : (
          <div className="space-y-4">
            <div className="font-medium text-[var(--color-text-primary)]">
              New Session
            </div>

            {/* Plugin selector */}
            {plugins.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {plugins.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    disabled={!p.health.available}
                    onClick={() => setSelectedPlugin(p.name)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      selectedPlugin === p.name
                        ? "bg-[var(--color-accent)] text-white"
                        : p.health.available
                          ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-accent-muted)]"
                          : "cursor-not-allowed bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] opacity-50"
                    }`}
                  >
                    <Terminal size={16} />
                    {p.display_name}
                    {!p.health.available && " (unavailable)"}
                  </button>
                ))}
              </div>
            )}

            {/* Name input */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                Session Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., dev-server"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                disabled={creating}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleCreate}
                disabled={creating || !name.trim()}
                className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Session"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {sessions.length === 0 && !showForm && (
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-bg-tertiary)]">
            <Layers size={32} className="text-[var(--color-text-muted)]" />
          </div>
          <p className="mt-4 text-[var(--color-text-secondary)]">
            No sessions on this server
          </p>
        </div>
      )}

      {/* Session list */}
      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.session_id}
            onClick={() => handleSelect(session.session_id, session.plugin)}
            className="group flex cursor-pointer items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--color-border-hover)] hover:shadow-lg hover:shadow-black/20"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)]">
                <Terminal
                  size={20}
                  className={
                    session.state === "active"
                      ? "text-[var(--color-success)]"
                      : "text-[var(--color-text-secondary)]"
                  }
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {session.name}
                  </span>
                  {session.plugin && session.plugin !== "shell" && (
                    <span className="rounded bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                      {plugins.find((p) => p.name === session.plugin)
                        ?.display_name ?? session.plugin}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      session.state === "active"
                        ? "bg-[var(--color-success)]"
                        : "bg-[var(--color-text-muted)]"
                    }`}
                  />
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
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(session.session_id);
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                confirmDeleteId === session.session_id
                  ? "bg-[var(--color-error)] text-white"
                  : "text-[var(--color-text-secondary)] opacity-0 hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-error)] group-hover:opacity-100"
              }`}
              title={
                confirmDeleteId === session.session_id
                  ? "Click to confirm"
                  : "Delete"
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/src/components/terminal/SessionPickerPage.tsx
git commit -m "feat(ui): redesign session picker with modern cards"
```

---

## Task 7: Update Terminal Page and Quick Action Bar

**Files:**
- Modify: `frontend/src/components/terminal/TerminalPage.tsx`
- Modify: `frontend/src/components/terminal/QuickActionBar.tsx`

**Step 1: Update QuickActionBar with Lucide icons**

```tsx
import type { QuickAction } from "@/types";
import { Trash2, X, MessageSquare, ArrowRight, RotateCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface QuickActionBarProps {
  actions: QuickAction[];
  onAction: (command: string) => void;
  disabled?: boolean;
}

const ICON_MAP: Record<string, LucideIcon> = {
  trash: Trash2,
  x: X,
  chat: MessageSquare,
  "arrow-right": ArrowRight,
  rotate: RotateCw,
};

export function QuickActionBar({
  actions,
  onAction,
  disabled,
}: QuickActionBarProps) {
  if (actions.length === 0) return null;

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 overflow-x-auto">
      {actions.map((action) => {
        const Icon = ICON_MAP[action.icon];
        return (
          <button
            key={action.command}
            onClick={() => onAction(action.command)}
            disabled={disabled}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition-all hover:bg-[var(--color-accent-muted)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            title={action.command}
          >
            {Icon && <Icon size={14} />}
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

**Step 2: Update TerminalPage with enhanced status bar**

```tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTerminal } from "@/hooks/useTerminal";
import { WebSocketService } from "@/services/websocket";
import { useDeviceClass } from "@/hooks/useDeviceClass";
import { useServerStore } from "@/stores/serverStore";
import { QuickActionBar } from "./QuickActionBar";
import type { WsConnectionState, QuickAction } from "@/types";
import { ArrowLeft, Wifi, WifiOff, Loader2 } from "lucide-react";

const STATUS_CONFIG: Record<
  WsConnectionState,
  { label: string; color: string; Icon: typeof Wifi }
> = {
  disconnected: { label: "Disconnected", color: "var(--color-error)", Icon: WifiOff },
  connecting: { label: "Connecting", color: "var(--color-warning)", Icon: Loader2 },
  authenticating: { label: "Authenticating", color: "var(--color-warning)", Icon: Loader2 },
  connected: { label: "Connected", color: "var(--color-success)", Icon: Wifi },
};

export function TerminalPage() {
  const deviceClass = useDeviceClass();
  const isMobile = deviceClass === "mobile";
  const { terminalRef, terminal, fit } = useTerminal({
    fontSize: isMobile ? 12 : 14,
    enableWebgl: !isMobile,
  });

  const wsRef = useRef<WebSocketService | null>(null);
  const [connState, setConnState] = useState<WsConnectionState>("disconnected");
  const [mobileInput, setMobileInput] = useState("");
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);

  const navigate = useNavigate();
  const { activeConnection, servers } = useServerStore();
  const activeServer = servers.find(
    (s) => s.id === activeConnection?.serverId
  );

  if (!wsRef.current) {
    wsRef.current = new WebSocketService();
  }
  const ws = wsRef.current;

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

    disposables.push(terminal.onData((data) => ws.sendInput(data)));
    disposables.push(
      terminal.onResize(({ cols, rows }) => ws.sendResize(cols, rows))
    );

    ws.connect(
      activeConnection.accessToken,
      activeConnection.sessionId,
      activeServer.url
    );

    return () => {
      disposables.forEach((d) => d.dispose());
      ws.disconnect();
    };
  }, [terminal, ws, activeConnection, activeServer, navigate]);

  useEffect(() => {
    if (!activeConnection?.plugin || !activeServer) {
      setQuickActions([]);
      return;
    }

    const fetchActions = async () => {
      try {
        const resp = await fetch(
          `${activeServer.url}/api/plugins/${activeConnection.plugin}`,
          {
            headers: { Authorization: `Bearer ${activeConnection.accessToken}` },
          }
        );
        if (resp.ok) {
          const data = await resp.json();
          setQuickActions(data.quick_actions ?? []);
        }
      } catch {
        // Non-critical
      }
    };

    fetchActions();
  }, [activeConnection?.plugin, activeConnection?.accessToken, activeServer]);

  useEffect(() => {
    fit();
  }, [fit, deviceClass]);

  const handleMobileSubmit = useCallback(() => {
    if (mobileInput.trim()) {
      ws.sendInput(mobileInput + "\n");
      setMobileInput("");
    }
  }, [mobileInput, ws]);

  const handleQuickAction = useCallback(
    (command: string) => {
      ws.sendInput(command + "\n");
    },
    [ws]
  );

  const status = STATUS_CONFIG[connState];
  const StatusIcon = status.Icon;

  return (
    <div className="flex h-full flex-col">
      {/* Status bar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/sessions")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <StatusIcon
              size={14}
              style={{ color: status.color }}
              className={connState === "connecting" || connState === "authenticating" ? "animate-spin" : ""}
            />
            <span className="text-sm text-[var(--color-text-secondary)]">
              {status.label}
            </span>
          </div>
        </div>
        {activeServer && (
          <div className="text-sm text-[var(--color-text-muted)]">
            {activeServer.name}
          </div>
        )}
      </div>

      {/* Quick action bar */}
      <QuickActionBar
        actions={quickActions}
        onAction={handleQuickAction}
        disabled={connState !== "connected"}
      />

      {/* Terminal container */}
      <div ref={terminalRef} className="min-h-0 flex-1" />

      {/* Mobile input bar */}
      {isMobile && (
        <div className="flex h-12 shrink-0 items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3">
          <input
            type="text"
            value={mobileInput}
            onChange={(e) => setMobileInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleMobileSubmit();
            }}
            placeholder="Type command..."
            className="flex-1 rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-1.5 font-mono text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:ring-1 focus:ring-[var(--color-accent)]"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <button
            onClick={handleMobileSubmit}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
          >
            Run
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add frontend/src/components/terminal/TerminalPage.tsx frontend/src/components/terminal/QuickActionBar.tsx
git commit -m "feat(ui): update terminal page and quick action bar with icons"
```

---

## Task 8: E2E Verification

**Step 1: Run full TypeScript check**

Run: `cd frontend && npx tsc --noEmit`

**Step 2: Visual verification with Playwright**

1. Start the app
2. Check each page:
   - Server list: cards, icons, hover states, add form
   - Login: centered card, icon, error state
   - Session picker: cards, plugin pills, delete button
   - Terminal: status bar, quick actions, back button
3. Check mobile layout (resize browser)
4. Check tablet layout

**Step 3: Commit all and tag**

```bash
git add -A
git commit -m "feat(ui): complete UI refresh with modern SaaS styling"
```
