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

export interface WsServerMessage {
  type: "auth.ok" | "auth.fail" | "output" | "pong" | "error";
  reason?: string;
  data?: string;
  message?: string;
}
