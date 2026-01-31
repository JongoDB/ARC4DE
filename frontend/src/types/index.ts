/**
 * Shared TypeScript type definitions for ARC4DE frontend.
 *
 * Types are added as features are implemented in subsequent phases.
 */

export interface HealthResponse {
  status: string;
}

export type DeviceClass = "mobile" | "tablet" | "desktop";

export interface RouteConfig {
  path: string;
  label: string;
}

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

export type WsServerMessage =
  | { type: "auth.ok" }
  | { type: "auth.fail"; reason?: string }
  | { type: "output"; data?: string }
  | { type: "pong" }
  | { type: "error"; message?: string }
  | { type: "tunnel.preview"; port: number; url: string }
  | { type: "tunnel.preview.closed"; port: number };

export interface ServerConfig {
  id: string;
  name: string;
  url: string;
  addedAt: number;
}

export interface SessionInfo {
  session_id: string;
  name: string;
  tmux_name: string;
  state: string;
  created_at: string;
  plugin: string;
}

export interface QuickAction {
  label: string;
  command: string;
  icon: string;
}

export interface PluginHealth {
  available: boolean;
  message: string | null;
}

export interface PluginInfo {
  name: string;
  display_name: string;
  command: string;
  quick_actions: QuickAction[];
  health: PluginHealth;
}
