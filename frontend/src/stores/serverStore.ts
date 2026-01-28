import { create } from "zustand";
import type { ServerConfig } from "@/types";
import { loadServers, saveServers } from "@/services/storage";

interface ServerConnection {
  serverId: string;
  accessToken: string;
  connectedAt: number;
  sessionId?: string;
}

interface ServerState {
  servers: ServerConfig[];
  activeConnection: ServerConnection | null;
  loaded: boolean;

  init: () => Promise<void>;
  addServer: (name: string, url: string) => Promise<ServerConfig>;
  updateServer: (id: string, name: string, url: string) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  setConnection: (serverId: string, accessToken: string) => void;
  setSession: (sessionId: string) => void;
  clearConnection: () => void;
}

export const useServerStore = create<ServerState>()((set, get) => ({
  servers: [],
  activeConnection: null,
  loaded: false,

  init: async () => {
    if (get().loaded) return;
    const servers = await loadServers();
    set({ servers, loaded: true });
  },

  addServer: async (name, url) => {
    const server: ServerConfig = {
      id: crypto.randomUUID(),
      name,
      url: url.replace(/\/+$/, ""),
      addedAt: Date.now(),
    };
    const next = [...get().servers, server];
    set({ servers: next });
    await saveServers(next);
    return server;
  },

  updateServer: async (id, name, url) => {
    const next = get().servers.map((s) =>
      s.id === id ? { ...s, name, url: url.replace(/\/+$/, "") } : s,
    );
    set({ servers: next });
    await saveServers(next);
  },

  removeServer: async (id) => {
    const next = get().servers.filter((s) => s.id !== id);
    set({ servers: next });
    await saveServers(next);
    if (get().activeConnection?.serverId === id) {
      set({ activeConnection: null });
    }
  },

  setConnection: (serverId, accessToken) => {
    set({
      activeConnection: { serverId, accessToken, connectedAt: Date.now() },
    });
  },

  setSession: (sessionId) => {
    const conn = get().activeConnection;
    if (conn) {
      set({ activeConnection: { ...conn, sessionId } });
    }
  },

  clearConnection: () => {
    set({ activeConnection: null });
  },
}));
