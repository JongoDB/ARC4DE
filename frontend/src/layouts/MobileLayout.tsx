import { Outlet, Link, useLocation } from "react-router-dom";
import { Server, Layers, Terminal } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "Servers", icon: Server },
  { path: "/sessions", label: "Sessions", icon: Layers },
  { path: "/terminal", label: "Terminal", icon: Terminal },
];

export function MobileLayout() {
  const location = useLocation();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4">
        <span className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
          ARC<span className="text-[var(--color-accent)]">4</span>DE
        </span>
      </header>

      {/* Main content */}
      <main className="min-h-0 flex-1 overflow-hidden bg-[var(--color-bg-primary)]">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="flex h-14 shrink-0 items-center justify-around border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 px-4 py-1 ${
                isActive
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-secondary)]"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
