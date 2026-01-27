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
