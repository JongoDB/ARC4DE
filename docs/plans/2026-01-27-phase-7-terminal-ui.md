# Phase 7: Terminal UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a fully functional terminal UI using xterm.js that connects to the backend via WebSocket, with GPU-accelerated rendering, automatic resize handling, and a mobile-friendly input bar.

**Architecture:** A `useTerminal` React hook manages the xterm.js `Terminal` instance lifecycle (create, open, dispose). A `WebSocketService` class handles the JSON-based WebSocket protocol (auth, input/output, resize, ping/pong, reconnection with exponential backoff). The `TerminalPage` component wires these together: the hook provides the terminal instance, the service provides the WebSocket connection, and `onData` / `onResize` bridge user input to the WebSocket. On mobile, a `MobileInputBar` sits below the terminal for thumb-friendly text input.

**Tech Stack:** @xterm/xterm 5.5, @xterm/addon-fit 0.10, @xterm/addon-webgl 0.18, Native WebSocket API, React 18 hooks, TypeScript

---

## Acceptance Criteria

1. Terminal renders in the browser with xterm.js (blinking cursor, dark theme)
2. Typing in the terminal sends input to the backend via WebSocket
3. Backend output (command results, prompts) appears in the terminal
4. Terminal auto-resizes when the browser window resizes (FitAddon)
5. Resize events sent to backend (`{ "type": "resize", "cols": N, "rows": N }`)
6. WebGL addon loaded on desktop/tablet for GPU-accelerated rendering (graceful fallback)
7. WebSocket reconnects with exponential backoff on disconnect
8. Connection status indicator shown (connecting/connected/disconnected)
9. Mobile input bar shown on mobile devices (thumb-friendly text input below terminal)
10. Terminal disposed cleanly on unmount (no memory leaks)
11. TypeScript compiles with zero errors
12. App works end-to-end: open browser → see terminal → type commands → see output

---

## Task 1: WebSocket Service

**Files:**
- Create: `frontend/src/services/websocket.ts`
- Modify: `frontend/src/types/index.ts`

**Context:** The backend WebSocket protocol uses JSON messages (not raw binary). The service manages the connection lifecycle: connect, authenticate with JWT, send/receive typed messages, auto-reconnect with exponential backoff, and ping/pong keepalive. This is a plain TypeScript class (no React dependencies) so it can be tested and reused.

The backend expects:
- First message: `{ "type": "auth", "token": "<jwt>", "session_id?": "..." }`
- After auth: `{ "type": "input", "data": "..." }`, `{ "type": "resize", "cols": N, "rows": N }`, `{ "type": "ping" }`
- Server sends: `{ "type": "output", "data": "..." }`, `{ "type": "auth.ok" }`, `{ "type": "auth.fail", "reason": "..." }`, `{ "type": "pong" }`, `{ "type": "error", "message": "..." }`

**Step 1: Add types**

In `frontend/src/types/index.ts`, add:

```typescript
// WebSocket message types
export type WsConnectionState = "disconnected" | "connecting" | "authenticating" | "connected";

export interface WsClientMessage {
  type: "auth" | "input" | "resize" | "ping";
  token?: string;
  session_id?: string;
  data?: string;
  cols?: number;
  rows?: number;
}

export interface WsServerMessage {
  type: "auth.ok" | "auth.fail" | "output" | "pong" | "error";
  reason?: string;
  data?: string;
  message?: string;
}
```

**Step 2: Create WebSocket service**

Create `frontend/src/services/websocket.ts`:

```typescript
import type { WsConnectionState, WsClientMessage, WsServerMessage } from "@/types";

export type WsEventHandler = {
  onOutput?: (data: string) => void;
  onStateChange?: (state: WsConnectionState) => void;
  onError?: (message: string) => void;
};

const PING_INTERVAL_MS = 30_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private handlers: WsEventHandler = {};
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private disposed = false;
  private token = "";
  private sessionId: string | undefined;
  private _state: WsConnectionState = "disconnected";

  get state(): WsConnectionState {
    return this._state;
  }

  setHandlers(handlers: WsEventHandler): void {
    this.handlers = handlers;
  }

  connect(token: string, sessionId?: string): void {
    this.token = token;
    this.sessionId = sessionId;
    this.disposed = false;
    this.reconnectAttempt = 0;
    this._connect();
  }

  disconnect(): void {
    this.disposed = true;
    this._cleanup();
    this._setState("disconnected");
  }

  sendInput(data: string): void {
    this._send({ type: "input", data });
  }

  sendResize(cols: number, rows: number): void {
    this._send({ type: "resize", cols, rows });
  }

  private _connect(): void {
    this._cleanup();
    this._setState("connecting");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/terminal`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this._setState("authenticating");
      const authMsg: WsClientMessage = {
        type: "auth",
        token: this.token,
      };
      if (this.sessionId) {
        authMsg.session_id = this.sessionId;
      }
      this.ws?.send(JSON.stringify(authMsg));
    };

    this.ws.onmessage = (event) => {
      let msg: WsServerMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case "auth.ok":
          this.reconnectAttempt = 0;
          this._setState("connected");
          this._startPing();
          break;

        case "auth.fail":
          this.handlers.onError?.(msg.reason ?? "Authentication failed");
          this._setState("disconnected");
          this._cleanup();
          break;

        case "output":
          if (msg.data) {
            this.handlers.onOutput?.(msg.data);
          }
          break;

        case "pong":
          break;

        case "error":
          this.handlers.onError?.(msg.message ?? "Unknown error");
          break;
      }
    };

    this.ws.onclose = () => {
      this._cleanup();
      if (!this.disposed && this._state !== "disconnected") {
        this._setState("disconnected");
        this._scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  private _send(msg: WsClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private _startPing(): void {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      this._send({ type: "ping" });
    }, PING_INTERVAL_MS);
  }

  private _stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private _scheduleReconnect(): void {
    if (this.disposed) return;
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt),
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      if (!this.disposed) {
        this._connect();
      }
    }, delay);
  }

  private _cleanup(): void {
    this._stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private _setState(state: WsConnectionState): void {
    this._state = state;
    this.handlers.onStateChange?.(state);
  }
}
```

**Step 3: Verify TypeScript compiles**

Run: `docker-compose exec frontend npx tsc --noEmit --project tsconfig.app.json`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/services/websocket.ts
git commit -m "feat(frontend): add WebSocket service with auth, reconnect, and ping/pong"
```

---

## Task 2: `useTerminal` Hook

**Files:**
- Create: `frontend/src/hooks/useTerminal.ts`

**Context:** This hook manages the xterm.js `Terminal` instance lifecycle. It creates the terminal with a dark theme, attaches the `FitAddon` for auto-resize, and optionally loads the `WebglAddon` for GPU rendering (with fallback). It returns a ref callback for the container div, the terminal instance, and a fit function.

The hook does NOT manage WebSocket — that's separate. It only manages the xterm.js instance.

**Step 1: Create the hook**

Create `frontend/src/hooks/useTerminal.ts`:

```typescript
import { useRef, useCallback, useEffect } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";

export interface UseTerminalOptions {
  fontSize?: number;
  enableWebgl?: boolean;
}

export interface UseTerminalResult {
  terminalRef: (el: HTMLDivElement | null) => void;
  terminal: Terminal | null;
  fit: () => void;
}

export function useTerminal(options: UseTerminalOptions = {}): UseTerminalResult {
  const { fontSize = 14, enableWebgl = true } = options;
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fit = useCallback(() => {
    fitAddonRef.current?.fit();
  }, []);

  const terminalRef = useCallback(
    (el: HTMLDivElement | null) => {
      // Cleanup previous instance
      if (termRef.current) {
        termRef.current.dispose();
        termRef.current = null;
        fitAddonRef.current = null;
      }

      containerRef.current = el;
      if (!el) return;

      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: "block",
        fontSize,
        fontFamily:
          '"JetBrains Mono", "Fira Code", "Cascadia Code", "SF Mono", Menlo, Monaco, "Courier New", monospace',
        scrollback: 5000,
        theme: {
          background: "#0a0e17",
          foreground: "#e5e7eb",
          cursor: "#3b82f6",
          selectionBackground: "#374151",
          black: "#000000",
          red: "#ef4444",
          green: "#22c55e",
          yellow: "#eab308",
          blue: "#3b82f6",
          magenta: "#a855f7",
          cyan: "#06b6d4",
          white: "#e5e7eb",
          brightBlack: "#6b7280",
          brightRed: "#f87171",
          brightGreen: "#4ade80",
          brightYellow: "#facc15",
          brightBlue: "#60a5fa",
          brightMagenta: "#c084fc",
          brightCyan: "#22d3ee",
          brightWhite: "#f9fafb",
        },
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      term.open(el);
      fitAddon.fit();

      // Try to load WebGL addon for GPU rendering
      if (enableWebgl) {
        try {
          const webglAddon = new WebglAddon();
          webglAddon.onContextLoss(() => {
            webglAddon.dispose();
          });
          term.loadAddon(webglAddon);
        } catch {
          // Canvas fallback — no action needed
        }
      }

      termRef.current = term;
      fitAddonRef.current = fitAddon;
    },
    [fontSize, enableWebgl],
  );

  // Handle window resize
  useEffect(() => {
    function handleResize() {
      fitAddonRef.current?.fit();
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      termRef.current?.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  return { terminalRef, terminal: termRef.current, fit };
}
```

**Step 2: Verify TypeScript compiles**

Run: `docker-compose exec frontend npx tsc --noEmit --project tsconfig.app.json`
Expected: No errors (xterm.js CSS import should be handled by Vite)

**Step 3: Commit**

```bash
git add frontend/src/hooks/useTerminal.ts
git commit -m "feat(frontend): add useTerminal hook with xterm.js, FitAddon, WebglAddon"
```

---

## Task 3: Terminal Page + Connection Wiring

**Files:**
- Modify: `frontend/src/components/terminal/TerminalPage.tsx`

**Context:** Replace the placeholder with a working terminal page. This component:
1. Creates a `WebSocketService` instance (once, via useRef)
2. Uses `useTerminal` to get the xterm.js terminal
3. Connects the terminal's `onData` to `ws.sendInput()` (user types → backend)
4. Connects `ws.onOutput` to `terminal.write()` (backend output → terminal)
5. Connects terminal's `onResize` to `ws.sendResize()` (size changes → backend)
6. Shows a connection status bar at the top
7. Auto-connects with a hardcoded token for now (auth flow comes in Phase 8)

For now, the page auto-logs-in using the `/api/auth/login` endpoint to get a token. This is temporary — Phase 8 will add proper auth flow with stored tokens.

**Step 1: Replace TerminalPage**

Replace `frontend/src/components/terminal/TerminalPage.tsx` with:

```tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useTerminal } from "@/hooks/useTerminal";
import { WebSocketService } from "@/services/websocket";
import { useDeviceClass } from "@/hooks/useDeviceClass";
import type { WsConnectionState } from "@/types";

const STATUS_LABELS: Record<WsConnectionState, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting...",
  authenticating: "Authenticating...",
  connected: "Connected",
};

const STATUS_COLORS: Record<WsConnectionState, string> = {
  disconnected: "var(--color-error)",
  connecting: "var(--color-warning)",
  authenticating: "var(--color-warning)",
  connected: "var(--color-success)",
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

  // Create WebSocket service once
  if (!wsRef.current) {
    wsRef.current = new WebSocketService();
  }
  const ws = wsRef.current;

  // Wire terminal <-> WebSocket
  useEffect(() => {
    if (!terminal) return;

    const disposables: { dispose: () => void }[] = [];

    // Terminal output from backend
    ws.setHandlers({
      onOutput: (data) => terminal.write(data),
      onStateChange: setConnState,
      onError: (msg) => terminal.writeln(`\r\n\x1b[31m[Error] ${msg}\x1b[0m`),
    });

    // Terminal input from user
    disposables.push(
      terminal.onData((data) => ws.sendInput(data)),
    );

    // Terminal resize
    disposables.push(
      terminal.onResize(({ cols, rows }) => ws.sendResize(cols, rows)),
    );

    // Auto-connect: get a token and connect
    // (Temporary — Phase 8 will use stored auth tokens)
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "changeme" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.access_token) {
          ws.connect(data.access_token);
        }
      })
      .catch(() => {
        terminal.writeln("\x1b[31m[Error] Failed to authenticate\x1b[0m");
      });

    return () => {
      disposables.forEach((d) => d.dispose());
      ws.disconnect();
    };
  }, [terminal, ws]);

  // Refit terminal when layout changes
  useEffect(() => {
    fit();
  }, [fit, deviceClass]);

  const handleMobileSubmit = useCallback(() => {
    if (mobileInput.trim()) {
      ws.sendInput(mobileInput + "\n");
      setMobileInput("");
    }
  }, [mobileInput, ws]);

  return (
    <div className="flex h-full flex-col">
      {/* Status bar */}
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)] px-3">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: STATUS_COLORS[connState] }}
        />
        <span className="text-xs text-[var(--color-text-secondary)]">
          {STATUS_LABELS[connState]}
        </span>
      </div>

      {/* Terminal container */}
      <div ref={terminalRef} className="min-h-0 flex-1" />

      {/* Mobile input bar */}
      {isMobile && (
        <div className="flex h-12 shrink-0 items-center gap-2 border-t border-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)] px-3">
          <input
            type="text"
            value={mobileInput}
            onChange={(e) => setMobileInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleMobileSubmit();
            }}
            placeholder="Type command..."
            className="flex-1 rounded bg-[var(--color-bg-tertiary)] px-3 py-1.5 font-mono text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-secondary)] focus:ring-1 focus:ring-[var(--color-accent)]"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <button
            onClick={handleMobileSubmit}
            className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
          >
            Run
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `docker-compose exec frontend npx tsc --noEmit --project tsconfig.app.json`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/terminal/TerminalPage.tsx
git commit -m "feat(frontend): wire TerminalPage with xterm.js and WebSocket"
```

---

## Task 4: End-to-End Verification + CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Context:** Verify the full stack works: open browser → navigate to Terminal → see xterm.js render → type a command → see output from the backend. Then update tracking.

**Step 1: Rebuild Docker**

```bash
docker-compose up -d --build
```

**Step 2: Verify TypeScript compiles**

```bash
docker-compose exec frontend npx tsc --noEmit --project tsconfig.app.json
```

**Step 3: Run backend tests (regression check)**

```bash
docker-compose exec backend python -m pytest tests/ -v
```

Expected: All 75 tests pass

**Step 4: Browser verification**

Open `http://localhost:5175/terminal` and verify:
1. xterm.js terminal renders with dark theme and blinking cursor
2. Connection status shows "Connecting..." → "Authenticating..." → "Connected"
3. Type `echo hello` + Enter → see "hello" in the output
4. Type `ls` → see file listing
5. Resize browser window → terminal adapts (no horizontal scrollbar)
6. On narrow viewport (< 768px), mobile input bar appears at bottom

**Step 5: Update CLAUDE.md**

Change current state:
```
**Phase:** Phase 8 - Server Management (NOT STARTED)
```
```
**Last completed:** Phase 7 - Terminal UI (xterm.js, WebSocket, fit/webgl addons, mobile input)
```

Update phase tracker:
```
| 7 | Terminal UI - xterm.js, mobile input, resize | COMPLETE |
```

**Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark Phase 7 terminal UI complete"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | WebSocket service (auth, reconnect, ping/pong) | 2 |
| 2 | useTerminal hook (xterm.js, fit, webgl) | 1 |
| 3 | TerminalPage wiring (terminal + WS + mobile input) | 1 |
| 4 | End-to-end verification + CLAUDE.md | 1 |
| **Total** | | **5** |
