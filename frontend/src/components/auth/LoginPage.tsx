import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useServerStore } from "@/stores/serverStore";

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

  // Redirect if no server specified or not found
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
      navigate("/terminal");
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
      <div className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            Connect to {server.name}
          </h1>
          <p className="mt-1 truncate text-sm text-[var(--color-text-secondary)]">
            {server.url}
          </p>
        </div>

        {error && (
          <div className="rounded bg-[var(--color-error)]/10 px-3 py-2 text-sm text-[var(--color-error)]">
            {error}
          </div>
        )}

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded bg-[var(--color-bg-tertiary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-secondary)] focus:ring-1 focus:ring-[var(--color-accent)]"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          disabled={submitting}
        />

        <button
          onClick={handleSubmit}
          disabled={submitting || !password.trim()}
          className="w-full rounded bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {submitting ? "Connecting..." : "Connect"}
        </button>

        <button
          onClick={() => navigate("/")}
          className="w-full text-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          Back to servers
        </button>
      </div>
    </div>
  );
}
