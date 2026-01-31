import { NavLink, Outlet } from "react-router-dom";
import { Server, Layers, Terminal } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", icon: Server, label: "Servers" },
  { to: "/sessions", icon: Layers, label: "Sessions" },
  { to: "/terminal", icon: Terminal, label: "Terminal" },
];

export function MobileLayout() {
  return (
    <div className="flex h-screen flex-col bg-[var(--color-bg-primary)]">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4">
        <span className="text-lg font-bold text-[var(--color-text-primary)]">
          ARC<span className="text-[var(--color-accent)]">4</span>DE
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          v{__APP_VERSION__}
        </span>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div style={{ padding: '24px 20px' }}>
          <Outlet />
        </div>
      </main>

      {/* Bottom navigation - 72px + safe area */}
      <nav className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex h-[72px] items-center justify-around px-4">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 rounded-xl px-4 py-2 transition-colors ${
                  isActive
                    ? "bg-[var(--color-accent-muted)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`
              }
            >
              <Icon size={24} />
              <span className="text-[11px] font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
