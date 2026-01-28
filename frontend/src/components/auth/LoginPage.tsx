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
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <span className="text-[var(--color-text-secondary)]">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-4">
        {/* Card */}
        <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-6">
          {/* Server info */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]">
              <Server size={24} className="text-[var(--color-accent)]" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {server.name}
              </h1>
              <p className="truncate text-sm text-[var(--color-text-muted)]">
                {server.url}
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
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
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Lock size={18} className="text-[var(--color-text-muted)]" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="h-12 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] pl-11 pr-4 text-base text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-muted)]"
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
            className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--color-accent)] text-[15px] font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Connecting..." : "Connect"}
          </button>
        </div>

        {/* Back link */}
        <button
          onClick={() => navigate("/")}
          className="flex h-11 items-center gap-2 text-[15px] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft size={18} />
          Back to servers
        </button>
      </div>
    </div>
  );
}
