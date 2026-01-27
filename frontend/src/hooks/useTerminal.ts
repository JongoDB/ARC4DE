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
