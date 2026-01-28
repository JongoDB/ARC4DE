import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useServerStore } from "@/stores/serverStore";
import { Server, Lock, ArrowLeft, AlertCircle } from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serverId = searchParams.get("server");

  const { servers, loaded, init, setConnection } = useServerStore();
  const server = servers.find((s) => s.id === serverId);

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (loaded && (!serverId || !server)) {
      navigate("/");
    }
  }, [loaded, serverId, server, navigate]);

  const handleSubmit = async () => {
    if (!server || !password.trim()) return;
    setError("");
    setSubmitting(true);

    try {
      const resp = await fetch(`${server.url}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        setError(data?.detail ?? `Login failed (${resp.status})`);
        setSubmitting(false);
        return;
      }

      const data = await resp.json();
      setConnection(server.id, data.access_token);
      navigate("/sessions");
    } catch {
      setError("Could not reach server. Check the URL and try again.");
      setSubmitting(false);
    }
  };

  if (!loaded || !server) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-[var(--color-text-secondary)]">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
          {/* Server info */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)]">
              <Server size={24} className="text-[var(--color-accent)]" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-semibold text-[var(--color-text-primary)]">
                {server.name}
              </h1>
              <p className="truncate text-sm text-[var(--color-text-muted)]">
                {server.url}
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3 py-2 text-sm text-[var(--color-error)]">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Password field */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Password
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !password.trim()}
            className="w-full rounded-lg bg-[var(--color-accent)] py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {submitting ? "Connecting..." : "Connect"}
          </button>
        </div>

        {/* Back link */}
        <button
          onClick={() => navigate("/")}
          className="mt-4 flex w-full items-center justify-center gap-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft size={16} />
          Back to servers
        </button>
      </div>
    </div>
  );
}
