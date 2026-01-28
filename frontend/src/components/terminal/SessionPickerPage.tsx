import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useServerStore } from "@/stores/serverStore";
import type { SessionInfo, PluginInfo } from "@/types";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function SessionPickerPage() {
  const navigate = useNavigate();
  const { activeConnection, servers, setSession, clearConnection } =
    useServerStore();
  const activeServer = servers.find(
    (s) => s.id === activeConnection?.serverId,
  );

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState("shell");

  // Redirect if not connected to a server
  useEffect(() => {
    if (!activeConnection || !activeServer) {
      navigate("/");
    }
  }, [activeConnection, activeServer, navigate]);

  const fetchSessions = useCallback(async () => {
    if (!activeServer || !activeConnection) return;
    try {
      const resp = await fetch(`${activeServer.url}/api/sessions`, {
        headers: { Authorization: `Bearer ${activeConnection.accessToken}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: SessionInfo[] = await resp.json();
      setSessions(data);
      setError("");
    } catch {
      setError("Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }, [activeServer, activeConnection]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Fetch available plugins on mount
  useEffect(() => {
    if (!activeServer || !activeConnection) return;
    (async () => {
      try {
        const resp = await fetch(`${activeServer.url}/api/plugins`, {
          headers: { Authorization: `Bearer ${activeConnection.accessToken}` },
        });
        if (!resp.ok) return;
        const data: PluginInfo[] = await resp.json();
        setPlugins(data);
      } catch {
        // Non-critical — plugin selector simply won't render
      }
    })();
  }, [activeServer, activeConnection]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || !activeServer || !activeConnection) return;
    setCreating(true);
    try {
      const resp = await fetch(`${activeServer.url}/api/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeConnection.accessToken}`,
        },
        body: JSON.stringify({ name: trimmed, plugin: selectedPlugin }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setName("");
      setSelectedPlugin("shell");
      setShowForm(false);
      await fetchSessions();
    } catch {
      setError("Failed to create session.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (confirmDeleteId === sessionId) {
      if (!activeServer || !activeConnection) return;
      try {
        await fetch(`${activeServer.url}/api/sessions/${sessionId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${activeConnection.accessToken}` },
        });
        setConfirmDeleteId(null);
        await fetchSessions();
      } catch {
        setError("Failed to delete session.");
      }
    } else {
      setConfirmDeleteId(sessionId);
    }
  };

  const handleSelect = (sessionId: string, plugin: string) => {
    if (confirmDeleteId) return;
    setSession(sessionId, plugin);
    navigate("/terminal");
  };

  const handleDisconnect = () => {
    clearConnection();
    navigate("/");
  };

  if (!activeConnection || !activeServer) return null;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-[var(--color-text-secondary)]">
          Loading sessions...
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            Sessions
          </h1>
          <p className="truncate text-xs text-[var(--color-text-secondary)]">
            {activeServer.name} — {activeServer.url}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {!showForm && (
            <button
              onClick={() => {
                setShowForm(true);
                setName("");
                setConfirmDeleteId(null);
              }}
              className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
            >
              New Session
            </button>
          )}
          <button
            onClick={handleDisconnect}
            className="rounded px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded bg-[var(--color-error)]/10 px-3 py-2 text-sm text-[var(--color-error)]">
          {error}
        </div>
      )}

      {/* New Session Form */}
      {showForm && (
        <div className="mb-4 rounded-lg border border-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)] p-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
            New Session
          </h2>
          <div className="space-y-3">
            {/* Plugin selector */}
            {plugins.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {plugins.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    disabled={!p.health.available}
                    onClick={() => setSelectedPlugin(p.name)}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                      selectedPlugin === p.name
                        ? "bg-[var(--color-accent)] text-white"
                        : p.health.available
                          ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-accent)]/20"
                          : "cursor-not-allowed bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] opacity-50"
                    }`}
                  >
                    {p.display_name}
                    {!p.health.available && " (unavailable)"}
                  </button>
                ))}
              </div>
            )}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Session name (e.g. dev server)"
              className="w-full rounded bg-[var(--color-bg-tertiary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-secondary)] focus:ring-1 focus:ring-[var(--color-accent)]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              disabled={creating}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating || !name.trim()}
                className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {sessions.length === 0 && !showForm && (
        <div className="flex flex-1 flex-col items-center justify-center">
          <p className="text-[var(--color-text-secondary)]">
            No sessions on this server.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
          >
            Create your first session
          </button>
        </div>
      )}

      {/* Session list */}
      <div className="space-y-2">
        {sessions.map((session) => (
          <div
            key={session.session_id}
            onClick={() => handleSelect(session.session_id, session.plugin)}
            className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)] p-4 transition-colors hover:border-[var(--color-accent)]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      session.state === "active"
                        ? "var(--color-success)"
                        : "var(--color-text-secondary)",
                  }}
                />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {session.name}
                </span>
                {session.plugin && session.plugin !== "shell" && (
                  <span className="rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-xs text-[var(--color-text-secondary)]">
                    {plugins.find((p) => p.name === session.plugin)
                      ?.display_name ?? session.plugin}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex gap-2 pl-4 text-xs text-[var(--color-text-secondary)]">
                <span>
                  {session.state === "active" ? "Active" : "Detached"}
                </span>
                {session.created_at && (
                  <>
                    <span>·</span>
                    <span>{relativeTime(session.created_at)}</span>
                  </>
                )}
              </div>
            </div>
            <div className="ml-3 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(session.session_id);
                }}
                className={`rounded px-2 py-1 text-xs ${
                  confirmDeleteId === session.session_id
                    ? "bg-[var(--color-error)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-error)]"
                }`}
              >
                {confirmDeleteId === session.session_id
                  ? "Confirm?"
                  : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
