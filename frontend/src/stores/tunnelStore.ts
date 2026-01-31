import { create } from "zustand";

interface PreviewTunnel {
  port: number;
  url: string;
}

interface TunnelState {
  sessionUrl: string | null;
  previews: PreviewTunnel[];
  loading: boolean;
  error: string | null;

  fetchTunnelInfo: (serverUrl: string, token: string) => Promise<void>;
  fetchTunnelInfoFromOrigin: () => Promise<void>;
  addPreview: (port: number, url: string) => void;
  removePreview: (port: number) => void;
  clearTunnels: () => void;
}

export const useTunnelStore = create<TunnelState>()((set, get) => ({
  sessionUrl: null,
  previews: [],
  loading: false,
  error: null,

  fetchTunnelInfo: async (serverUrl: string, token: string) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${serverUrl}/api/tunnel`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      set({
        sessionUrl: data.session_url,
        previews: data.previews || [],
        loading: false,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to fetch tunnel info",
        loading: false,
      });
    }
  },

  fetchTunnelInfoFromOrigin: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch("/api/tunnel");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      set({
        sessionUrl: data.session_url,
        previews: data.previews || [],
        loading: false,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to fetch tunnel info",
        loading: false,
      });
    }
  },

  addPreview: (port: number, url: string) => {
    const existing = get().previews.filter((p) => p.port !== port);
    set({ previews: [...existing, { port, url }] });
  },

  removePreview: (port: number) => {
    set({ previews: get().previews.filter((p) => p.port !== port) });
  },

  clearTunnels: () => {
    set({ sessionUrl: null, previews: [], error: null });
  },
}));
