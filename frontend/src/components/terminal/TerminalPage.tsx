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
    (s) => s.id === activeConnection?.serverId,
  );

  // Create WebSocket service once
  if (!wsRef.current) {
    wsRef.current = new WebSocketService();
  }
  const ws = wsRef.current;

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

  // Refit terminal when layout changes
  useEffect(() => {
    fit();
  }, [fit, deviceClass]);

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
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/sessions")}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <StatusIcon
              size={18}
              style={{ color: status.color }}
              className={connState === "connecting" || connState === "authenticating" ? "animate-spin" : ""}
            />
            <span className="text-sm font-medium">
              {status.label}
            </span>
          </div>
        </div>
        {activeServer && (
          <div className="text-sm text-[var(--color-text-secondary)]">
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
        <div className="flex h-14 shrink-0 items-center gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4">
          <input
            type="text"
            value={mobileInput}
            onChange={(e) => setMobileInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleMobileSubmit();
            }}
            placeholder="Type command..."
            className="h-11 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 font-mono text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <button
            onClick={handleMobileSubmit}
            className="h-11 rounded-lg bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            Run
          </button>
        </div>
      )}
    </div>
  );
}
