import { NavLink, Outlet } from "react-router-dom";
import { Server, Layers, Terminal } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", icon: Server, label: "Servers" },
  { to: "/sessions", icon: Layers, label: "Sessions" },
  { to: "/terminal", icon: Terminal, label: "Terminal" },
];

export function DesktopLayout() {
  return (
    <div className="flex h-screen bg-[var(--color-bg-primary)]">
      {/* Sidebar - 240px */}
      <aside className="flex w-60 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        {/* Logo */}
        <div className="flex h-16 items-center px-5">
          <span className="text-xl font-bold text-[var(--color-text-primary)]">
            ARC<span className="text-[var(--color-accent)]">4</span>DE
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2">
          <div className="space-y-1">
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `flex h-12 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition-colors ${
                    isActive
                      ? "border-l-[3px] border-[var(--color-accent)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
                  }`
                }
              >
                <Icon size={20} />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </aside>

      {/* Main content with max-width container */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-10 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
