import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { path: "/", label: "Servers" },
  { path: "/sessions", label: "Sessions" },
  { path: "/terminal", label: "Terminal" },
];

export function MobileLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)] px-4">
        <span className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
          ARC<span className="text-[var(--color-accent)]">4</span>DE
        </span>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex h-8 w-8 items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
          aria-label="Toggle menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </header>

      {/* Slide-down nav menu */}
      {menuOpen && (
        <nav className="border-b border-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)]">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMenuOpen(false)}
              className={`block px-4 py-3 text-sm ${
                location.pathname === item.path
                  ? "bg-[var(--color-bg-tertiary)] text-[var(--color-accent)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}

      {/* Content */}
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
