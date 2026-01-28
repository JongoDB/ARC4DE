import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Server, Pencil, Trash2, ExternalLink } from "lucide-react";
import { useServerStore } from "@/stores/serverStore";
import type { ServerConfig } from "@/types";

export function ServerListPage() {
  const navigate = useNavigate();
  const { servers, loaded, init, addServer, updateServer, removeServer } =
    useServerStore();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) return;

    if (editingId) {
      await updateServer(editingId, trimmedName, trimmedUrl);
    } else {
      await addServer(trimmedName, trimmedUrl);
    }
    resetForm();
  };

  const startEdit = (server: ServerConfig) => {
    setEditingId(server.id);
    setName(server.name);
    setUrl(server.url);
    setShowForm(true);
    setConfirmDeleteId(null);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setUrl("");
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId === id) {
      await removeServer(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

  const handleCardClick = (server: ServerConfig) => {
    if (confirmDeleteId || editingId) return;
    navigate(`/login?server=${server.id}`);
  };

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-[var(--color-text-secondary)]">Loading...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Servers
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {servers.length} server{servers.length !== 1 ? "s" : ""} configured
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="flex h-11 items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 text-[15px] font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              <Plus className="h-4 w-4" />
              Add Server
            </button>
          )}
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-6">
            <h2 className="mb-4 text-base font-semibold text-[var(--color-text-primary)]">
              {editingId ? "Edit Server" : "Add New Server"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                  Server Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Home Lab"
                  className="h-12 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 text-base text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-muted)]"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                  Server URL
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="e.g. https://myserver.example.com"
                  className="h-12 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 text-base text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-muted)]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                  }}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSubmit}
                  className="flex h-11 items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 text-[15px] font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
                >
                  {editingId ? "Save Changes" : "Add Server"}
                </button>
                <button
                  onClick={resetForm}
                  className="flex h-11 items-center rounded-lg border border-[var(--color-border)] px-6 text-[15px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {servers.length === 0 && !showForm && (
          <div className="flex flex-1 flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)]">
              <Server className="h-8 w-8 text-[var(--color-text-secondary)]" />
            </div>
            <p className="mb-1 text-lg font-medium text-[var(--color-text-primary)]">
              No servers yet
            </p>
            <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
              Add your first server to get started
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="flex h-11 items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 text-[15px] font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              <Plus className="h-4 w-4" />
              Add Server
            </button>
          </div>
        )}

        {/* Server list */}
        <div className="space-y-4">
          {servers.map((server) => (
            <div
              key={server.id}
              onClick={() => handleCardClick(server)}
              className="group flex cursor-pointer items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-6 transition-colors hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-elevated)]"
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]">
                  <Server className="h-5 w-5 text-[var(--color-accent)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {server.name}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-[var(--color-text-secondary)] opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="truncate text-sm text-[var(--color-text-secondary)]">
                    {server.url}
                  </div>
                </div>
              </div>
              <div className="ml-3 flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(server);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
                  title="Edit server"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(server.id);
                  }}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                    confirmDeleteId === server.id
                      ? "bg-[var(--color-error)] text-white"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-error)]"
                  }`}
                  title={confirmDeleteId === server.id ? "Click to confirm" : "Delete server"}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
    </div>
  );
}
