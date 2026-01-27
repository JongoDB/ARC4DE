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
