import { NavLink, Outlet } from "react-router-dom";
import { Server, Layers, Terminal } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", icon: Server, label: "Servers" },
  { to: "/sessions", icon: Layers, label: "Sessions" },
  { to: "/terminal", icon: Terminal, label: "Terminal" },
];

export function TabletLayout() {
  return (
    <div className="flex h-screen bg-[var(--color-bg-primary)]">
      {/* Narrow sidebar - 72px, icons only */}
      <aside className="flex w-[72px] flex-col items-center border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-4">
        {/* Logo - just the "4" */}
        <div className="mb-4 flex h-10 w-10 items-center justify-center">
          <span className="text-2xl font-bold text-[var(--color-accent)]">4</span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              title={label}
              className={({ isActive }) =>
                `flex h-14 w-14 items-center justify-center rounded-xl transition-colors ${
                  isActive
                    ? "bg-[var(--color-bg-tertiary)] text-[var(--color-accent)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
                }`
              }
            >
              <Icon size={24} />
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
