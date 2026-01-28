import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useServerStore } from "@/stores/serverStore";
import type { SessionInfo, PluginInfo } from "@/types";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Terminal,
  LogOut,
} from "lucide-react";

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
    <div className="flex h-full flex-col overflow-y-auto px-5 py-8 sm:p-0">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between gap-4 sm:px-6 sm:pt-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {activeServer.name}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              {sessions.length} session{sessions.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          className="flex h-11 items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 text-[15px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
        >
          <LogOut size={18} />
          Disconnect
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 rounded-lg bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)] sm:mx-6">
          {error}
        </div>
      )}

      {/* New Session Card */}
      <div className="mb-6 sm:mx-6">
        {!showForm ? (
          <button
            onClick={() => {
              setShowForm(true);
              setName("");
              setCreating(false);
              setSelectedPlugin("shell");
              setConfirmDeleteId(null);
            }}
            className="group flex w-full items-center gap-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-6 transition-all hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-elevated)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] transition-colors group-hover:bg-[var(--color-accent)] group-hover:text-white">
              <Plus size={24} />
            </div>
            <div className="text-left">
              <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                New Session
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                Create a new terminal session
              </p>
            </div>
          </button>
        ) : (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-8">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white">
                <Plus size={24} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  New Session
                </h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Configure your new terminal session
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Plugin selector as pills */}
              {plugins.length > 0 && (
                <div>
                  <label className="mb-3 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    Session Type
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {plugins.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        disabled={!p.health.available}
                        onClick={() => setSelectedPlugin(p.name)}
                        className={
                          selectedPlugin === p.name
                            ? "flex h-11 items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 text-[15px] font-medium text-white"
                            : "flex h-11 items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 text-[15px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] disabled:cursor-not-allowed disabled:opacity-50"
                        }
                      >
                        <Terminal size={18} />
                        {p.display_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Session name input */}
              <div>
                <label className="mb-3 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                  Session Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., dev server, build, logs"
                  className="h-12 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 text-base text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-muted)] disabled:opacity-50"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") setShowForm(false);
                  }}
                  disabled={creating}
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCreate}
                  disabled={creating || !name.trim()}
                  className="flex h-11 items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 text-[15px] font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? (
                    "Creating..."
                  ) : (
                    <>
                      <Plus size={18} />
                      Create Session
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="flex h-11 items-center rounded-lg border border-[var(--color-border)] px-6 text-[15px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {sessions.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)]">
            <Terminal size={32} className="text-[var(--color-text-muted)]" />
          </div>
          <p className="mb-1 text-lg font-semibold text-[var(--color-text-primary)]">
            No sessions yet
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">
            Create your first terminal session to get started
          </p>
        </div>
      )}

      {/* Session list */}
      {sessions.length > 0 && (
        <div className="space-y-4 sm:px-6 sm:pb-6">
          {sessions.map((session) => (
            <div
              key={session.session_id}
              onClick={() => handleSelect(session.session_id, session.plugin)}
              className="group flex cursor-pointer items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-6 transition-colors hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-elevated)]"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                    session.state === "active"
                      ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                      : "bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]"
                  }`}
                >
                  <Terminal size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {session.name}
                    </span>
                    {session.plugin && session.plugin !== "shell" && (
                      <span className="rounded-md bg-[var(--color-bg-elevated)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                        {plugins.find((p) => p.name === session.plugin)
                          ?.display_name ?? session.plugin}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        session.state === "active"
                          ? "bg-[var(--color-success)]"
                          : "bg-[var(--color-text-muted)]"
                      }`}
                    />
                    <span>
                      {session.state === "active" ? "Active" : "Detached"}
                    </span>
                    {session.created_at && (
                      <>
                        <span className="text-[var(--color-text-muted)]">
                          ·
                        </span>
                        <span>{relativeTime(session.created_at)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(session.session_id);
                }}
                className={
                  confirmDeleteId === session.session_id
                    ? "flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-error)] text-white"
                    : "flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-text-secondary)] opacity-0 transition-all hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-error)] group-hover:opacity-100"
                }
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
