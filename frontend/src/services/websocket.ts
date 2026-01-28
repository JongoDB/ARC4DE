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
  private baseUrl: string | undefined;
  private _state: WsConnectionState = "disconnected";

  get state(): WsConnectionState {
    return this._state;
  }

  setHandlers(handlers: WsEventHandler): void {
    this.handlers = handlers;
  }

  connect(token: string, sessionId?: string, baseUrl?: string): void {
    this.token = token;
    this.sessionId = sessionId;
    this.baseUrl = baseUrl;
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

    this.ws.onmessage = (event: MessageEvent) => {
      let msg: WsServerMessage;
      try {
        msg = JSON.parse(event.data as string) as WsServerMessage;
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
