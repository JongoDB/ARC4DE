import { Outlet, Link, useLocation } from "react-router-dom";
import { Server, Layers, Terminal } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "Servers", icon: Server },
  { path: "/sessions", label: "Sessions", icon: Layers },
  { path: "/terminal", label: "Terminal", icon: Terminal },
];

export function TabletLayout() {
  const location = useLocation();

  return (
    <div className="flex h-full">
      {/* Narrow sidebar - icons only */}
      <aside className="flex w-16 shrink-0 flex-col items-center border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        {/* Logo */}
        <div className="flex h-14 w-full items-center justify-center border-b border-[var(--color-border)]">
          <span className="text-lg font-bold text-[var(--color-accent)]">4</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          <div className="flex flex-col items-center gap-2">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={item.label}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                    isActive
                      ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main className="min-h-0 min-w-0 flex-1 bg-[var(--color-bg-primary)]">
        <Outlet />
      </main>
    </div>
  );
}
