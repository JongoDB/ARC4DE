# Phase 6: Frontend Shell Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the frontend navigation shell with React Router, adaptive layout system (`useDeviceClass` hook), and three device-specific layout components so the app can navigate between views and adapt to mobile/tablet/desktop.

**Architecture:** React Router v7 provides client-side routing with four routes: server list (landing), login, session picker, and terminal. A `useDeviceClass()` hook detects viewport width and returns `"mobile" | "tablet" | "desktop"`. Three layout wrapper components (`MobileLayout`, `TabletLayout`, `DesktopLayout`) render route content with device-appropriate chrome (hamburger menu vs sidebar vs persistent panel). A shared `<AppShell>` component selects the correct layout based on the hook.

**Tech Stack:** React 18, TypeScript, React Router v7, TailwindCSS v4, Zustand (for future state), CSS custom properties (already defined in global.css)

---

## Acceptance Criteria

1. React Router mounted with four routes: `/` (server list), `/login` (login), `/sessions` (session picker), `/terminal` (terminal)
2. `useDeviceClass()` hook returns `"mobile" | "tablet" | "desktop"` based on viewport width breakpoints (768px, 1200px)
3. `<AppShell>` component renders the correct layout based on device class
4. `MobileLayout` renders a full-screen single-pane view with a top header bar and hamburger icon
5. `TabletLayout` renders a collapsible sidebar + main content area
6. `DesktopLayout` renders a persistent sidebar + main content area
7. Placeholder page components exist for all four routes with appropriate titles
8. Navigation between routes works (links/buttons)
9. TypeScript compiles with zero errors (`tsc -b`)
10. App renders in browser at `http://localhost:5175` via Docker

---

## Task 1: Types + `useDeviceClass` Hook

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/hooks/useDeviceClass.ts`

**Context:** The architecture design specifies three device classes: mobile (<768px), tablet (768-1199px), desktop (1200px+). The hook uses `window.matchMedia` for SSR-safe breakpoint detection with a resize listener. This hook is the foundation for all adaptive layout decisions.

**Step 1: Add types**

In `frontend/src/types/index.ts`, add:

```typescript
export type DeviceClass = "mobile" | "tablet" | "desktop";

export interface RouteConfig {
  path: string;
  label: string;
}
```

**Step 2: Create `useDeviceClass` hook**

Create `frontend/src/hooks/useDeviceClass.ts`:

```typescript
import { useState, useEffect } from "react";
import type { DeviceClass } from "@/types";

const TABLET_MIN = 768;
const DESKTOP_MIN = 1200;

function getDeviceClass(width: number): DeviceClass {
  if (width >= DESKTOP_MIN) return "desktop";
  if (width >= TABLET_MIN) return "tablet";
  return "mobile";
}

export function useDeviceClass(): DeviceClass {
  const [deviceClass, setDeviceClass] = useState<DeviceClass>(() =>
    getDeviceClass(window.innerWidth),
  );

  useEffect(() => {
    function handleResize() {
      setDeviceClass(getDeviceClass(window.innerWidth));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return deviceClass;
}
```

**Step 3: Verify TypeScript compiles**

Run: `docker-compose exec frontend npx tsc -b --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/hooks/useDeviceClass.ts
git commit -m "feat(frontend): add DeviceClass type and useDeviceClass hook"
```

---

## Task 2: Placeholder Page Components

**Files:**
- Create: `frontend/src/components/server/ServerListPage.tsx`
- Create: `frontend/src/components/auth/LoginPage.tsx`
- Create: `frontend/src/components/terminal/SessionPickerPage.tsx`
- Create: `frontend/src/components/terminal/TerminalPage.tsx`

**Context:** Each route needs a placeholder page component. These will be fleshed out in later phases (Phase 7: Terminal UI, Phase 8: Server Management, etc). For now they show the page title and a placeholder message. Each page accepts no props — routing context comes from React Router.

**Step 1: Create ServerListPage**

Create `frontend/src/components/server/ServerListPage.tsx`:

```tsx
export function ServerListPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
        Servers
      </h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        No servers configured yet.
      </p>
    </div>
  );
}
```

**Step 2: Create LoginPage**

Create `frontend/src/components/auth/LoginPage.tsx`:

```tsx
export function LoginPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
        Login
      </h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        Authentication form coming in Phase 8.
      </p>
    </div>
  );
}
```

**Step 3: Create SessionPickerPage**

Create `frontend/src/components/terminal/SessionPickerPage.tsx`:

```tsx
export function SessionPickerPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
        Sessions
      </h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        Session picker coming in Phase 9.
      </p>
    </div>
  );
}
```

**Step 4: Create TerminalPage**

Create `frontend/src/components/terminal/TerminalPage.tsx`:

```tsx
export function TerminalPage() {
  return (
    <div className="flex h-full flex-col bg-black">
      <div className="flex h-full items-center justify-center">
        <p className="font-mono text-[var(--color-text-secondary)]">
          Terminal UI coming in Phase 7.
        </p>
      </div>
    </div>
  );
}
```

**Step 5: Verify TypeScript compiles**

Run: `docker-compose exec frontend npx tsc -b --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add frontend/src/components/server/ServerListPage.tsx \
       frontend/src/components/auth/LoginPage.tsx \
       frontend/src/components/terminal/SessionPickerPage.tsx \
       frontend/src/components/terminal/TerminalPage.tsx
git commit -m "feat(frontend): add placeholder page components for all routes"
```

---

## Task 3: Layout Components

**Files:**
- Create: `frontend/src/layouts/MobileLayout.tsx`
- Create: `frontend/src/layouts/TabletLayout.tsx`
- Create: `frontend/src/layouts/DesktopLayout.tsx`
- Create: `frontend/src/layouts/AppShell.tsx`

**Context:** Three layout components wrap route content with device-appropriate chrome. `AppShell` selects the correct layout using `useDeviceClass()`. All layouts render an `<Outlet />` from React Router for nested route content.

- **MobileLayout**: Full-screen, top header bar with app name + hamburger icon, content fills remaining space. No sidebar.
- **TabletLayout**: Collapsible left sidebar (240px) with nav links + main content area. Sidebar toggle button in header.
- **DesktopLayout**: Persistent left sidebar (240px) + main content area. No toggle needed — sidebar always visible.

**Step 1: Create MobileLayout**

Create `frontend/src/layouts/MobileLayout.tsx`:

```tsx
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
```

**Step 2: Create TabletLayout**

Create `frontend/src/layouts/TabletLayout.tsx`:

```tsx
import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { path: "/", label: "Servers" },
  { path: "/sessions", label: "Sessions" },
  { path: "/terminal", label: "Terminal" },
];

export function TabletLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)]">
          <div className="flex h-12 items-center justify-between border-b border-[var(--color-bg-tertiary)] px-4">
            <span className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
              ARC<span className="text-[var(--color-accent)]">4</span>DE
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
              aria-label="Close sidebar"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
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
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!sidebarOpen && (
          <header className="flex h-12 shrink-0 items-center border-b border-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)] px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
              aria-label="Open sidebar"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="ml-3 text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
              ARC<span className="text-[var(--color-accent)]">4</span>DE
            </span>
          </header>
        )}
        <main className="min-h-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

**Step 3: Create DesktopLayout**

Create `frontend/src/layouts/DesktopLayout.tsx`:

```tsx
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
```

**Step 4: Create AppShell**

Create `frontend/src/layouts/AppShell.tsx`:

```tsx
import { useDeviceClass } from "@/hooks/useDeviceClass";
import { MobileLayout } from "./MobileLayout";
import { TabletLayout } from "./TabletLayout";
import { DesktopLayout } from "./DesktopLayout";

export function AppShell() {
  const deviceClass = useDeviceClass();

  switch (deviceClass) {
    case "mobile":
      return <MobileLayout />;
    case "tablet":
      return <TabletLayout />;
    case "desktop":
      return <DesktopLayout />;
  }
}
```

**Step 5: Verify TypeScript compiles**

Run: `docker-compose exec frontend npx tsc -b --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add frontend/src/layouts/MobileLayout.tsx \
       frontend/src/layouts/TabletLayout.tsx \
       frontend/src/layouts/DesktopLayout.tsx \
       frontend/src/layouts/AppShell.tsx
git commit -m "feat(frontend): add adaptive layout components and AppShell"
```

---

## Task 4: React Router + App Integration

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`

**Context:** Wire everything together. `main.tsx` wraps `<App />` in `<BrowserRouter>`. `App.tsx` defines the route table with `<AppShell>` as the layout route (using React Router's `<Outlet>` pattern) and all four page components as child routes.

**Step 1: Update App.tsx**

Replace `frontend/src/App.tsx` with:

```tsx
import { Routes, Route } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import { ServerListPage } from "@/components/server/ServerListPage";
import { LoginPage } from "@/components/auth/LoginPage";
import { SessionPickerPage } from "@/components/terminal/SessionPickerPage";
import { TerminalPage } from "@/components/terminal/TerminalPage";

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<ServerListPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/sessions" element={<SessionPickerPage />} />
        <Route path="/terminal" element={<TerminalPage />} />
      </Route>
    </Routes>
  );
}

export default App;
```

**Step 2: Update main.tsx**

Replace `frontend/src/main.tsx` with:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

**Step 3: Verify TypeScript compiles**

Run: `docker-compose exec frontend npx tsc -b --noEmit`
Expected: No errors

**Step 4: Rebuild and verify in browser**

```bash
docker-compose up -d --build frontend
```

Open `http://localhost:5175` in browser. Verify:
- Landing page shows "Servers" placeholder
- Sidebar/hamburger shows navigation links
- Clicking "Sessions" navigates to `/sessions`
- Clicking "Terminal" navigates to `/terminal`
- Resizing browser window switches layout (mobile < 768px, tablet 768-1199px, desktop 1200px+)

**Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/main.tsx
git commit -m "feat(frontend): wire React Router with adaptive layout shell"
```

---

## Task 5: Integration Verification + CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Context:** Final verification that everything works end-to-end, then update project tracking.

**Step 1: Rebuild Docker**

```bash
docker-compose up -d --build
```

**Step 2: Verify TypeScript compiles**

```bash
docker-compose exec frontend npx tsc -b --noEmit
```

Expected: No errors

**Step 3: Verify in browser**

Open `http://localhost:5175` and test:
1. Desktop layout (>= 1200px): Persistent sidebar with nav links, main content shows "Servers"
2. Tablet layout (768-1199px): Collapsible sidebar with toggle button
3. Mobile layout (< 768px): Hamburger menu in top header, slide-down nav
4. Navigate to each route: `/`, `/login`, `/sessions`, `/terminal`
5. All pages render their placeholder content

**Step 4: Run backend tests (regression check)**

```bash
docker-compose exec backend python -m pytest tests/ -v
```

Expected: All existing tests still pass

**Step 5: Update CLAUDE.md**

Change current state:
```
**Phase:** Phase 7 - Terminal UI (NOT STARTED)
```
```
**Last completed:** Phase 6 - Frontend Shell (React Router, adaptive layouts, useDeviceClass hook)
```

Update phase tracker:
```
| 6 | Frontend Shell - React Router, adaptive layouts | COMPLETE |
```

**Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark Phase 6 frontend shell complete"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Types + `useDeviceClass` hook | 2 |
| 2 | Placeholder page components (4 pages) | 4 |
| 3 | Layout components (Mobile, Tablet, Desktop, AppShell) | 4 |
| 4 | React Router + App integration | 2 |
| 5 | Integration verification + CLAUDE.md | 1 |
| **Total** | | **13** |
