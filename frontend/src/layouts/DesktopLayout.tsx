import { Outlet, Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { path: "/", label: "Servers" },
  { path: "/sessions", label: "Sessions" },
  { path: "/terminal", label: "Terminal" },
];

export function DesktopLayout() {
  const location = useLocation();

  return (
    <div className="flex h-full">
      {/* Persistent sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)]">
        <div className="flex h-12 items-center border-b border-[var(--color-bg-tertiary)] px-4">
          <span className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
            ARC<span className="text-[var(--color-accent)]">4</span>DE
          </span>
        </div>
        <nav className="flex-1 py-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-4 py-2 text-sm ${
                location.pathname === item.path
                  ? "bg-[var(--color-bg-tertiary)] text-[var(--color-accent)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="min-h-0 min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
