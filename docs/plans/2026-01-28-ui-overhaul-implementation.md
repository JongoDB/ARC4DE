# UI Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete visual overhaul with Discord/Slack aesthetic - proper spacing, visible cards, large touch targets.

**Architecture:** Update CSS variables first, then layouts (where spacing lives), then individual pages. Each change should be visually verifiable.

**Tech Stack:** React, TypeScript, TailwindCSS, Lucide React

---

## Task 1: Update Global CSS Variables

**Files:**
- Modify: `frontend/src/styles/global.css`

**Step 1: Replace the color variables**

Replace the `:root` block with Discord-inspired colors:

```css
:root {
  /* Backgrounds - more contrast between layers */
  --color-bg-primary: #0a0e17;
  --color-bg-secondary: #1a1d24;
  --color-bg-tertiary: #2b2d31;
  --color-bg-elevated: #32353b;

  /* Borders - actually visible */
  --color-border: #3f4147;
  --color-border-hover: #4f545c;

  /* Text - better contrast */
  --color-text-primary: #f2f3f5;
  --color-text-secondary: #b5bac1;
  --color-text-muted: #80848e;

  /* Accent - Discord blurple */
  --color-accent: #5865f2;
  --color-accent-hover: #4752c4;
  --color-accent-muted: rgba(88, 101, 242, 0.2);

  /* Status */
  --color-success: #23a559;
  --color-warning: #f0b232;
  --color-error: #da373c;
}
```

**Step 2: Run dev server and visually verify**

Run: `cd frontend && npm run dev`
Expected: Colors should update across the app (may look broken until layouts are fixed)

**Step 3: Commit**

```bash
git add frontend/src/styles/global.css
git commit -m "style: update color palette to Discord-inspired theme"
```

---

## Task 2: Redesign Desktop Layout

**Files:**
- Modify: `frontend/src/layouts/DesktopLayout.tsx`

**Step 1: Update the layout structure**

The sidebar should be 240px wide with proper nav item sizing. Content area needs max-width container.

Key changes:
- Sidebar: `w-60` (240px), `bg-[var(--color-bg-secondary)]`, `border-r border-[var(--color-border)]`
- Nav items: `h-12` (48px), `px-3`, `gap-3`, `rounded-lg`
- Active state: `bg-[var(--color-bg-tertiary)]` + `border-l-[3px] border-[var(--color-accent)]`
- Content wrapper: `max-w-4xl mx-auto px-8 py-8`
- Logo area: More padding, larger text

**Step 2: Implement the changes**

```tsx
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
        <div className="mx-auto max-w-4xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
```

**Step 3: Verify visually**

Open http://localhost:5175 at 1280px+ width.
Expected: 240px sidebar with clear border, centered content area, 48px tall nav items

**Step 4: Commit**

```bash
git add frontend/src/layouts/DesktopLayout.tsx
git commit -m "style(layout): redesign desktop sidebar with proper sizing"
```

---

## Task 3: Redesign Mobile Layout

**Files:**
- Modify: `frontend/src/layouts/MobileLayout.tsx`

**Step 1: Update the layout**

Key changes:
- Header: 56px tall, proper padding
- Bottom nav: 72px tall + safe area padding
- Nav items: 24px icons, pill background for active state
- Content: Remove the max-width container wrapper (pages handle their own padding)

```tsx
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
      <header className="flex h-14 shrink-0 items-center justify-center border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <span className="text-lg font-bold text-[var(--color-text-primary)]">
          ARC<span className="text-[var(--color-accent)]">4</span>DE
        </span>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
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
```

**Step 2: Verify visually**

Resize browser to <768px width.
Expected: 56px header, content area, 72px bottom nav with pill-style active state

**Step 3: Commit**

```bash
git add frontend/src/layouts/MobileLayout.tsx
git commit -m "style(layout): redesign mobile layout with larger touch targets"
```

---

## Task 4: Redesign Tablet Layout

**Files:**
- Modify: `frontend/src/layouts/TabletLayout.tsx`

**Step 1: Update the layout**

Key changes:
- Sidebar: 72px wide, icons only, 24px icons
- Nav items: 56px tall, centered
- Border between sidebar and content

```tsx
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
```

**Step 2: Verify visually**

Resize browser to 768px-1199px width.
Expected: 72px icon-only sidebar, centered icons, clear active state

**Step 3: Commit**

```bash
git add frontend/src/layouts/TabletLayout.tsx
git commit -m "style(layout): redesign tablet sidebar with icon-only nav"
```

---

## Task 5: Redesign Server List Page

**Files:**
- Modify: `frontend/src/components/server/ServerListPage.tsx`

**Step 1: Update the component**

Key changes:
- Remove the container padding (layout handles it now for desktop, page handles mobile)
- Cards: visible background (`bg-tertiary`), visible border, 20px padding, 48px icon area
- Buttons: 44px height, larger padding
- Inputs: 48px height, 16px font
- Server name: text-lg font-semibold
- Mobile: Add horizontal padding since layout doesn't add it

Full component rewrite focusing on spacing and sizing. Key CSS changes:

**Card:**
```tsx
className="group flex cursor-pointer items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-5 transition-colors hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-elevated)]"
```

**Primary button:**
```tsx
className="flex h-11 items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 text-[15px] font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
```

**Input:**
```tsx
className="h-12 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 text-base text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-muted)]"
```

**Icon container:**
```tsx
className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg-elevated)]"
```

**Step 2: Handle mobile padding**

Wrap content in: `<div className="px-4 py-6 sm:px-0 sm:py-0">` for mobile horizontal padding.

**Step 3: Verify visually**

Check at desktop and mobile sizes.
Expected: Visible cards with clear borders, larger buttons and inputs, proper spacing

**Step 4: Commit**

```bash
git add frontend/src/components/server/ServerListPage.tsx
git commit -m "style(servers): redesign with visible cards and larger touch targets"
```

---

## Task 6: Redesign Login Page

**Files:**
- Modify: `frontend/src/components/auth/LoginPage.tsx`

**Step 1: Update the component**

Key changes:
- Card: visible border and background, more padding (24px)
- Input: 48px height, 16px font
- Button: 44px height, full width on mobile
- Server icon: 48px container
- Add mobile padding wrapper

**Step 2: Verify visually**

Navigate to login page at various sizes.
Expected: Centered card with visible border, large input and button

**Step 3: Commit**

```bash
git add frontend/src/components/auth/LoginPage.tsx
git commit -m "style(login): redesign with larger form elements"
```

---

## Task 7: Redesign Session Picker Page

**Files:**
- Modify: `frontend/src/components/terminal/SessionPickerPage.tsx`

**Step 1: Update the component**

Key changes:
- Same card styling as server list
- Session cards: visible borders, proper padding
- New session form: larger inputs and buttons
- Back button: 44px touch target
- Mobile padding wrapper

**Step 2: Verify visually**

Login and check sessions page.
Expected: Visible session cards, large buttons, proper spacing

**Step 3: Commit**

```bash
git add frontend/src/components/terminal/SessionPickerPage.tsx
git commit -m "style(sessions): redesign with visible cards and larger touch targets"
```

---

## Task 8: Update Terminal Page and Quick Actions

**Files:**
- Modify: `frontend/src/components/terminal/TerminalPage.tsx`
- Modify: `frontend/src/components/terminal/QuickActionBar.tsx`

**Step 1: Update QuickActionBar**

- Button height: 40px minimum
- Larger padding and icon sizes
- Visible background on buttons

**Step 2: Update TerminalPage**

- Status bar: proper height and padding
- Back button: 44px touch target
- Mobile input bar: 48px input height

**Step 3: Verify visually**

Connect to a session and check terminal page.
Expected: Larger quick action buttons, proper status bar sizing

**Step 4: Commit**

```bash
git add frontend/src/components/terminal/TerminalPage.tsx frontend/src/components/terminal/QuickActionBar.tsx
git commit -m "style(terminal): update quick actions and status bar sizing"
```

---

## Task 9: Final Verification

**Step 1: Run TypeScript check**

Run: `cd frontend && npm run build`
Expected: No errors

**Step 2: Visual verification at all breakpoints**

1. Desktop (1280px): Check sidebar, content container, cards
2. Tablet (900px): Check icon sidebar
3. Mobile (375px): Check bottom nav, cards, buttons

**Step 3: Verify all touch targets**

Use browser dev tools to check element sizes:
- Buttons: >= 44px height
- Nav items: >= 44px
- Inputs: >= 48px

**Step 4: Commit and tag**

```bash
git add -A
git commit -m "style: complete UI overhaul with Discord-inspired theme"
git tag v0.11.0
```
