import { NavLink, Outlet } from "react-router-dom";
import { Server, Layers, Terminal } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", icon: Server, label: "Servers" },
  { to: "/sessions", icon: Layers, label: "Sessions" },
  { to: "/terminal", icon: Terminal, label: "Terminal" },
];

export function DesktopLayout() {
  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {/* Sidebar - 280px */}
      <aside
        className="flex w-[280px] flex-col"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        {/* Logo */}
        <div className="flex h-16 items-center" style={{ padding: '0 20px' }}>
          <span className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            ARC<span style={{ color: 'var(--color-accent)' }}>4</span>DE
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1" style={{ padding: '8px 12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `flex items-center rounded-lg transition-colors ${
                    isActive ? "font-medium" : ""
                  }`
                }
                style={({ isActive }) => ({
                  height: '48px',
                  padding: '0 12px',
                  gap: '12px',
                  borderRadius: '8px',
                  fontSize: '15px',
                  backgroundColor: isActive ? 'var(--color-bg-elevated)' : 'transparent',
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  borderLeft: isActive ? '3px solid var(--color-accent)' : '3px solid transparent',
                })}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.classList.contains('active')) {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                  }
                }}
                onMouseLeave={(e) => {
                  const isActive = e.currentTarget.getAttribute('aria-current') === 'page';
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <Icon size={20} />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Version */}
        <div style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            v{__APP_VERSION__}
          </span>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
