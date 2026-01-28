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
    <div className="flex h-full flex-col overflow-y-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
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
            className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            <Plus className="h-4 w-4" />
            Add Server
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)] p-5">
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
                className="w-full rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-secondary)] focus:ring-2 focus:ring-[var(--color-accent)]"
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
                className="w-full rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-secondary)] focus:ring-2 focus:ring-[var(--color-accent)]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSubmit}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
              >
                {editingId ? "Save Changes" : "Add Server"}
              </button>
              <button
                onClick={resetForm}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {servers.length === 0 && !showForm && (
        <div className="flex flex-1 flex-col items-center justify-center">
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
            className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            <Plus className="h-4 w-4" />
            Add Server
          </button>
        </div>
      )}

      {/* Server list */}
      <div className="space-y-3">
        {servers.map((server) => (
          <div
            key={server.id}
            onClick={() => handleCardClick(server)}
            className="group flex cursor-pointer items-center justify-between rounded-xl border border-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:shadow-lg hover:shadow-[var(--color-accent)]/10"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)]">
                <Server className="h-5 w-5 text-[var(--color-accent)]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--color-text-primary)]">
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
                className="rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
                title="Edit server"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(server.id);
                }}
                className={`rounded-lg p-2 transition-colors ${
                  confirmDeleteId === server.id
                    ? "bg-[var(--color-error)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-error)]"
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
