import { Outlet, Link, useLocation } from "react-router-dom";
import { Server, Layers, Terminal } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "Servers", icon: Server },
  { path: "/sessions", label: "Sessions", icon: Layers },
  { path: "/terminal", label: "Terminal", icon: Terminal },
];

export function DesktopLayout() {
  const location = useLocation();

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        {/* Logo */}
        <div className="flex h-14 items-center border-b border-[var(--color-border)] px-5">
          <span className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
            ARC<span className="text-[var(--color-accent)]">4</span>DE
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  {item.label}
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
