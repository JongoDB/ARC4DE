# Phase 11: Quick Actions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a plugin-driven action bar to the terminal UI that displays quick action buttons based on the current session's plugin.

**Architecture:** The frontend needs to know which plugin a session uses, fetch that plugin's quick actions from the API, and render them as clickable buttons above the terminal. Clicking a button sends the command through the WebSocket. Shell plugin has basic actions (clear, exit); Claude Code has AI-specific actions.

**Tech Stack:** React, TypeScript, WebSocket, FastAPI

---

## Task 1: Add Shell Plugin Quick Actions

**Files:**
- Modify: `backend/app/plugins/shell/plugin.py:14-15`
- Test: `backend/tests/test_plugin_shell.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_plugin_shell.py`:

```python
def test_shell_quick_actions_exist():
    """Shell plugin should have basic terminal quick actions."""
    plugin = ShellPlugin()
    actions = plugin.get_quick_actions()
    assert len(actions) >= 2
    labels = [a.label for a in actions]
    assert "Clear" in labels
    assert "Exit" in labels


def test_shell_quick_actions_structure():
    """Each quick action should have label, command, and icon."""
    plugin = ShellPlugin()
    actions = plugin.get_quick_actions()
    for action in actions:
        assert action.label
        assert action.command
        assert action.icon
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_plugin_shell.py::test_shell_quick_actions_exist -v`
Expected: FAIL (returns empty list currently)

**Step 3: Write minimal implementation**

Update `backend/app/plugins/shell/plugin.py`:

```python
"""Shell built-in plugin — default raw terminal, no CLI wrapping."""

from app.plugins.base import Plugin, QuickAction, PluginHealth


class ShellPlugin(Plugin):
    name = "shell"
    display_name = "Shell"
    command = ""  # Empty = use default shell

    async def initialize(self) -> bool:
        return True

    def get_quick_actions(self) -> list[QuickAction]:
        return [
            QuickAction(label="Clear", command="clear", icon="trash"),
            QuickAction(label="Exit", command="exit", icon="x"),
        ]

    def get_health(self) -> PluginHealth:
        return PluginHealth(available=True)
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_plugin_shell.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/plugins/shell/plugin.py backend/tests/test_plugin_shell.py
git commit -m "feat(plugins): add quick actions to shell plugin"
```

---

## Task 2: Extend ServerStore to Track Plugin Name

**Files:**
- Modify: `frontend/src/stores/serverStore.ts:5-10,73-78`
- Test: Manual (state management)

**Step 1: Update ServerConnection interface**

In `frontend/src/stores/serverStore.ts`, add `plugin` to the connection:

```typescript
interface ServerConnection {
  serverId: string;
  accessToken: string;
  connectedAt: number;
  sessionId?: string;
  plugin?: string;  // Add this
}
```

**Step 2: Update setSession to accept plugin**

Change the `setSession` method signature and update the interface:

```typescript
interface ServerState {
  servers: ServerConfig[];
  activeConnection: ServerConnection | null;
  loaded: boolean;

  init: () => Promise<void>;
  addServer: (name: string, url: string) => Promise<ServerConfig>;
  updateServer: (id: string, name: string, url: string) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  setConnection: (serverId: string, accessToken: string) => void;
  setSession: (sessionId: string, plugin?: string) => void;  // Add plugin param
  clearConnection: () => void;
}
```

Update the implementation:

```typescript
  setSession: (sessionId, plugin) => {
    const conn = get().activeConnection;
    if (conn) {
      set({ activeConnection: { ...conn, sessionId, plugin } });
    }
  },
```

**Step 3: Run TypeScript check**

Run: `cd frontend && npm run typecheck`
Expected: PASS (no type errors)

**Step 4: Commit**

```bash
git add frontend/src/stores/serverStore.ts
git commit -m "feat(store): track plugin name in active connection"
```

---

## Task 3: Pass Plugin Name When Selecting Session

**Files:**
- Modify: `frontend/src/components/terminal/SessionPickerPage.tsx:123-127`

**Step 1: Update handleSelect to pass plugin**

Find the `handleSelect` function and update it to pass the plugin:

```typescript
  const handleSelect = (sessionId: string, plugin: string) => {
    if (confirmDeleteId) return;
    setSession(sessionId, plugin);
    navigate("/terminal");
  };
```

**Step 2: Update the onClick handler in the session list**

Find where `handleSelect` is called (around line 268) and update:

```typescript
            onClick={() => handleSelect(session.session_id, session.plugin)}
```

**Step 3: Run TypeScript check and dev server**

Run: `cd frontend && npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add frontend/src/components/terminal/SessionPickerPage.tsx
git commit -m "feat(sessions): pass plugin name when selecting session"
```

---

## Task 4: Create QuickActionBar Component

**Files:**
- Create: `frontend/src/components/terminal/QuickActionBar.tsx`
- Modify: `frontend/src/types/index.ts` (no changes needed, QuickAction already exists)

**Step 1: Create the QuickActionBar component**

Create `frontend/src/components/terminal/QuickActionBar.tsx`:

```typescript
import type { QuickAction } from "@/types";

interface QuickActionBarProps {
  actions: QuickAction[];
  onAction: (command: string) => void;
  disabled?: boolean;
}

const ICON_MAP: Record<string, string> = {
  trash: "🗑️",
  x: "✕",
  chat: "💬",
  "arrow-right": "→",
  rotate: "↻",
};

export function QuickActionBar({ actions, onAction, disabled }: QuickActionBarProps) {
  if (actions.length === 0) return null;

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)] px-3 overflow-x-auto">
      {actions.map((action) => (
        <button
          key={action.command}
          onClick={() => onAction(action.command)}
          disabled={disabled}
          className="flex shrink-0 items-center gap-1.5 rounded bg-[var(--color-bg-tertiary)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-accent)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
          title={action.command}
        >
          <span>{ICON_MAP[action.icon] ?? "•"}</span>
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Run TypeScript check**

Run: `cd frontend && npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/components/terminal/QuickActionBar.tsx
git commit -m "feat(terminal): create QuickActionBar component"
```

---

## Task 5: Integrate QuickActionBar into TerminalPage

**Files:**
- Modify: `frontend/src/components/terminal/TerminalPage.tsx`

**Step 1: Add imports and state**

At the top of the file, add:

```typescript
import { QuickActionBar } from "./QuickActionBar";
import type { WsConnectionState, QuickAction } from "@/types";
```

Add state for quick actions inside the component:

```typescript
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
```

**Step 2: Fetch quick actions when connected**

Add a useEffect to fetch plugin quick actions:

```typescript
  // Fetch quick actions for the current plugin
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
        // Non-critical - action bar just won't show
      }
    };

    fetchActions();
  }, [activeConnection?.plugin, activeConnection?.accessToken, activeServer]);
```

**Step 3: Add handler for quick action clicks**

Add a callback to send commands:

```typescript
  const handleQuickAction = useCallback(
    (command: string) => {
      ws.sendInput(command + "\n");
    },
    [ws]
  );
```

**Step 4: Render the QuickActionBar**

Insert between the status bar and terminal container:

```typescript
      {/* Quick action bar */}
      <QuickActionBar
        actions={quickActions}
        onAction={handleQuickAction}
        disabled={connState !== "connected"}
      />
```

**Step 5: Run TypeScript check**

Run: `cd frontend && npm run typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add frontend/src/components/terminal/TerminalPage.tsx
git commit -m "feat(terminal): integrate QuickActionBar with plugin actions"
```

---

## Task 6: Backend Tests for Quick Action API

**Files:**
- Test: `backend/tests/test_api_plugins.py`

**Step 1: Add test for quick actions in plugin response**

Add to `backend/tests/test_api_plugins.py`:

```python
def test_get_plugin_includes_quick_actions(
    client: TestClient, auth_headers: dict, setup_plugin_manager
):
    """Plugin detail endpoint should include quick_actions array."""
    resp = client.get("/api/plugins/shell", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "quick_actions" in data
    assert isinstance(data["quick_actions"], list)
    # Shell plugin should have at least Clear and Exit
    labels = [a["label"] for a in data["quick_actions"]]
    assert "Clear" in labels
    assert "Exit" in labels


def test_quick_action_structure(
    client: TestClient, auth_headers: dict, setup_plugin_manager
):
    """Each quick action should have label, command, and icon."""
    resp = client.get("/api/plugins/shell", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    for action in data["quick_actions"]:
        assert "label" in action
        assert "command" in action
        assert "icon" in action
```

**Step 2: Run tests**

Run: `cd backend && python -m pytest tests/test_api_plugins.py -v`
Expected: PASS

**Step 3: Commit**

```bash
git add backend/tests/test_api_plugins.py
git commit -m "test(api): add tests for quick actions in plugin response"
```

---

## Task 7: E2E Verification and CLAUDE.md Update

**Files:**
- Modify: `CLAUDE.md` (update phase status)

**Step 1: Run full backend test suite**

Run: `cd backend && python -m pytest -v`
Expected: All tests pass

**Step 2: Run TypeScript checks**

Run: `cd frontend && npm run typecheck`
Expected: No errors

**Step 3: Visual E2E test**

1. Start the app: `docker compose up -d && cd frontend && npm run dev`
2. Navigate to http://localhost:5175
3. Log in to a server
4. Create a new Shell session
5. Select the session → Terminal page should show:
   - Status bar (Connected)
   - **Quick action bar with "Clear" and "Exit" buttons**
   - Terminal
6. Click "Clear" → terminal should clear
7. Create a Claude Code session (if available)
8. Select it → should show Claude Code quick actions
9. Close browser

**Step 4: Update CLAUDE.md**

Update the phase status table:
- Change `Phase 12 - QR Code Pairing (NOT STARTED)` to current phase header
- Mark Phase 11 as COMPLETE in the table

**Step 5: Commit and tag**

```bash
git add CLAUDE.md
git commit -m "docs: mark Phase 11 Quick Actions complete"
git tag v0.10.0
git push origin master --tags
```
